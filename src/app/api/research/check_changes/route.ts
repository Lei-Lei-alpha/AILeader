import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSettings } from '@/lib/settings';
import { readProjectMeta } from '@/lib/projectMeta';

const SUPPORTED_EXT = new Set(['.md', '.pdf', '.docx', '.txt']);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder');
    if (!folder) return NextResponse.json({ error: 'folder required' }, { status: 400 });

    const settings = await getSettings();
    if (!settings.folders?.includes(folder)) {
      return NextResponse.json({ error: 'Folder not registered' }, { status: 403 });
    }

    const meta = await readProjectMeta(folder);
    if (!meta || meta.fileIndex.length === 0) {
      return NextResponse.json({ needsReindex: false, reason: 'no-index' });
    }

    // Build a map of last-indexed timestamps from meta
    const indexedMap = new Map<string, number>(
      meta.fileIndex.map((e) => [e.filePath, e.lastModified])
    );

    // Scan the folder for supported files
    let needsReindex = false;
    let changedCount = 0;
    const scan = async (dir: string, depth = 0) => {
      if (depth > 1) return;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await scan(full, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!SUPPORTED_EXT.has(ext)) continue;
            const stat = await fs.stat(full);
            const lastIndexed = indexedMap.get(full);
            if (!lastIndexed || stat.mtimeMs > lastIndexed + 1000) {
              needsReindex = true;
              changedCount++;
            }
          }
        }
      } catch { /* ignore unreadable dirs */ }
    };

    await scan(folder);
    return NextResponse.json({ needsReindex, changedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
