import { NextResponse } from 'next/server';
import path from 'path';
import { getSettings } from '@/lib/settings';
import { indexProjectFiles, getIndexStatus } from '@/lib/fileIndexer';

function isAllowedFolder(folder: string, allowed: string[]): boolean {
  const n = path.normalize(folder);
  return allowed.some((f) => path.normalize(f) === n);
}

// GET ?folder=<path> — returns index status without running Ollama
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get('folder');
  if (!folder) return NextResponse.json({ error: 'folder required' }, { status: 400 });

  const settings = await getSettings();
  if (!isAllowedFolder(folder, settings.folders)) {
    return NextResponse.json({ error: 'Folder not registered' }, { status: 403 });
  }

  try {
    const status = await getIndexStatus(folder);
    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { folder, force? } — runs the indexer (can take several minutes for large folders)
export async function POST(request: Request) {
  const body = await request.json();
  const { folder, force } = body as { folder: string; force?: boolean };
  if (!folder) return NextResponse.json({ error: 'folder required' }, { status: 400 });

  const settings = await getSettings();
  if (!isAllowedFolder(folder, settings.folders)) {
    return NextResponse.json({ error: 'Folder not registered' }, { status: 403 });
  }

  try {
    const result = await indexProjectFiles(folder, force ?? false);
    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    console.error('Index route error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
