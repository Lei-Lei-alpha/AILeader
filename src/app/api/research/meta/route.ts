import { NextResponse } from 'next/server';
import path from 'path';
import { getSettings } from '@/lib/settings';
import { readProjectMeta, initProjectMeta, updateProjectMeta } from '@/lib/projectMeta';
import type { ProjectMeta } from '@/lib/types';

function isAllowedFolder(folder: string, allowedFolders: string[]): boolean {
  const normalized = path.normalize(folder);
  return allowedFolders.some((f) => path.normalize(f) === normalized);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get('folder');

  if (!folder) {
    return NextResponse.json({ error: 'folder query param required' }, { status: 400 });
  }

  const settings = await getSettings();
  if (!isAllowedFolder(folder, settings.folders)) {
    return NextResponse.json({ error: 'Folder not registered' }, { status: 403 });
  }

  try {
    const meta = (await readProjectMeta(folder)) ?? (await initProjectMeta(folder));
    return NextResponse.json(meta);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { folder, updates } = body as { folder: string; updates: Partial<Omit<ProjectMeta, 'version'>> };

    if (!folder) {
      return NextResponse.json({ error: 'folder required' }, { status: 400 });
    }

    const settings = await getSettings();
    if (!isAllowedFolder(folder, settings.folders)) {
      return NextResponse.json({ error: 'Folder not registered' }, { status: 403 });
    }

    const meta = await updateProjectMeta(folder, updates ?? {});
    return NextResponse.json(meta);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
