import fs from 'fs/promises';
import path from 'path';
// @ts-ignore
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { generateText } from './universalLLM';
import { readProjectMeta, writeProjectMeta, initProjectMeta } from './projectMeta';
import type { FileIndexEntry } from './types';

// Files we can index. .doc omitted — word-extractor needs a file path, not a buffer.
const INDEXABLE_EXTENSIONS = new Set(['.md', '.pdf', '.docx', '.txt']);

// Caps on stored/summary text to keep context budgets sane
const STORED_TEXT_LIMIT = 8_000;
const SUMMARY_INPUT_LIMIT = 6_000;

// Dirs to never descend into
const SKIP_DIRS = new Set(['.archive', '.git', 'node_modules', '.next']);

export interface IndexResult {
  indexed: number;
  skipped: number;
  failed: number;
  total: number;
}

// ── Text extraction ───────────────────────────────────────────────────────────

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const buf = await fs.readFile(filePath);

  if (ext === '.pdf') {
    const data = await pdfParse(buf);
    return data.text as string;
  }
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value;
  }
  // .md / .txt / fallback
  return buf.toString('utf-8');
}

// ── LLM summary + keyword generation ─────────────────────────────────────────

async function summarise(
  text: string
): Promise<{ summary: string; keywords: string[] }> {
  const truncated = text.substring(0, SUMMARY_INPUT_LIMIT);

  const prompt = `Summarize the following research document in one concise paragraph (max 120 words). \
Then list exactly 5 key scientific keywords.

DOCUMENT:
${truncated}

Respond with EXACTLY this format and nothing else:
SUMMARY: <one paragraph summary>
KEYWORDS: ["kw1", "kw2", "kw3", "kw4", "kw5"]`;

  try {
    const raw = await generateText(prompt, { temperature: 0.2 });

    const sumMatch = raw.match(/SUMMARY:\s*([\s\S]*?)(?=KEYWORDS:|$)/);
    const kwMatch = raw.match(/KEYWORDS:\s*(\[[\s\S]*?\])/);

    const summary = sumMatch ? sumMatch[1].trim() : raw.substring(0, 300).trim();
    let keywords: string[] = [];
    if (kwMatch) {
      try { keywords = JSON.parse(kwMatch[1]); } catch { /* keep empty */ }
    }

    return { summary, keywords };
  } catch {
    // Graceful fallback: use raw text excerpt as summary
    return { summary: text.substring(0, 300).trim(), keywords: [] };
  }
}

// ── Folder scanner (top-level + 1 subdirectory deep) ─────────────────────────

async function collectIndexableFiles(folderPath: string): Promise<string[]> {
  const results: string[] = [];

  async function scan(dir: string, depth: number) {
    let entries: string[];
    try { entries = await fs.readdir(dir); } catch { return; }

    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const full = path.join(dir, entry);
      let stat;
      try { stat = await fs.stat(full); } catch { continue; }

      if (stat.isDirectory()) {
        if (depth === 0 && !SKIP_DIRS.has(entry)) await scan(full, depth + 1);
      } else if (stat.isFile()) {
        const ext = path.extname(entry).toLowerCase();
        if (INDEXABLE_EXTENSIONS.has(ext)) results.push(full);
      }
    }
  }

  await scan(folderPath, 0);
  return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function indexProjectFiles(
  folderPath: string,
  force = false
): Promise<IndexResult> {
  const meta = (await readProjectMeta(folderPath)) ?? (await initProjectMeta(folderPath));
  const allFiles = await collectIndexableFiles(folderPath);

  const result: IndexResult = { indexed: 0, skipped: 0, failed: 0, total: allFiles.length };

  // Work on a mutable copy we can write back incrementally
  const indexMap = new Map<string, FileIndexEntry>(
    meta.fileIndex.map((e) => [e.filePath, e])
  );

  for (const filePath of allFiles) {
    let stat;
    try { stat = await fs.stat(filePath); } catch { result.failed++; continue; }

    const mtimeMs = stat.mtimeMs;
    const existing = indexMap.get(filePath);

    // Skip if already indexed and file hasn't changed (1 s tolerance)
    if (!force && existing && existing.lastIndexed > 0 && existing.lastModified >= mtimeMs - 1000) {
      result.skipped++;
      continue;
    }

    try {
      const rawText = await extractText(filePath);
      const extractedText = rawText.substring(0, STORED_TEXT_LIMIT);
      const { summary, keywords } = await summarise(rawText);

      const ext = path.extname(filePath).toLowerCase();
      const fileType: FileIndexEntry['fileType'] =
        ext === '.md' ? 'md' :
        ext === '.pdf' ? 'pdf' :
        (ext === '.docx' || ext === '.doc') ? 'docx' : 'other';

      const entry: FileIndexEntry = {
        filePath,
        relativePath: path.relative(folderPath, filePath),
        fileType,
        extractedText,
        summary,
        keywords,
        lastIndexed: Date.now(),
        lastModified: mtimeMs,
      };

      indexMap.set(filePath, entry);
      result.indexed++;

      // Write incrementally so partial progress survives a timeout
      const currentMeta = (await readProjectMeta(folderPath)) ?? meta;
      await writeProjectMeta(folderPath, {
        ...currentMeta,
        fileIndex: Array.from(indexMap.values()),
        lastProgressCheck: Date.now(),
      });
    } catch (e) {
      console.error(`Failed to index ${filePath}:`, e);
      result.failed++;
    }
  }

  return result;
}

// Returns counts without running LLM — used by FileIndexStatus
export async function getIndexStatus(folderPath: string): Promise<{
  total: number;
  indexed: number;
  lastIndexed: number | null;
  files: Array<{ relativePath: string; fileType: string; lastIndexed: number }>;
}> {
  const allFiles = await collectIndexableFiles(folderPath);
  const meta = await readProjectMeta(folderPath);
  const fileIndex = meta?.fileIndex ?? [];

  const lastIndexed =
    fileIndex.length > 0 ? Math.max(...fileIndex.map((e) => e.lastIndexed)) : null;

  return {
    total: allFiles.length,
    indexed: fileIndex.length,
    lastIndexed,
    files: fileIndex.map((e) => ({
      relativePath: e.relativePath,
      fileType: e.fileType,
      lastIndexed: e.lastIndexed,
    })),
  };
}
