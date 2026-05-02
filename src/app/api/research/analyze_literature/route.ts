import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSettings } from '@/lib/settings';
import { readProjectMeta } from '@/lib/projectMeta';
import { generateText } from '@/lib/universalLLM';

const PROMPT_PATH = path.join(process.cwd(), '.prompts', 'literature_analysis.md');

export async function POST(request: Request) {
  const { folder } = await request.json() as { folder: string };
  if (!folder) return NextResponse.json({ error: 'folder required' }, { status: 400 });

  const meta = await readProjectMeta(folder);
  if (!meta) {
    return NextResponse.json({ error: 'No project metadata found. Add a folder and index it first.' }, { status: 400 });
  }

  const indexed = meta.fileIndex.filter((e) => e.summary);
  if (indexed.length === 0) {
    return NextResponse.json({ error: 'No indexed files with summaries. Please run "Index Project" first.' }, { status: 400 });
  }

  // Load prompt template
  let systemPrompt: string;
  try {
    systemPrompt = await fs.readFile(PROMPT_PATH, 'utf8');
  } catch {
    systemPrompt = `You are analyzing a body of literature for a research project. Provide: key themes, research gaps, methodological patterns, recommended citations, and suggested research angles.`;
  }

  // Build context: each indexed file as a structured block
  const fileContext = indexed
    .map((e) => `### ${e.relativePath} [${e.fileType.toUpperCase()}]\nSummary: ${e.summary}\nKeywords: ${e.keywords.join(', ')}`)
    .join('\n\n');

  const prompt = `${systemPrompt}

## Project: ${meta.project.displayName}
Stage: ${meta.project.stage}
Description: ${meta.project.description || '(none)'}

## Literature Corpus (${indexed.length} indexed files)
${fileContext}

Provide a full structured literature analysis.`;

  try {
    const analysis = await generateText(prompt, { temperature: 0.3 });

    // Append analysis to .ai_memory.md so it feeds future chat/plan prompts
    const memoryPath = path.join(folder, '.ai_memory.md');
    const stamp = new Date().toISOString();
    await fs.appendFile(memoryPath, `\n\n## Literature Analysis — ${stamp}\n${analysis}\n`, 'utf8').catch(() => {});

    return NextResponse.json({ success: true, analysis });
  } catch (e: any) {
    console.error('Literature analysis error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
