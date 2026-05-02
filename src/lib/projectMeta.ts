import fs from 'fs/promises';
import path from 'path';
import type { ProjectMeta, ResearchStage } from './types';

const META_FILENAME = '.research_meta.json';

export function metaPath(folderPath: string): string {
  return path.join(folderPath, META_FILENAME);
}

export async function readProjectMeta(folderPath: string): Promise<ProjectMeta | null> {
  try {
    const data = await fs.readFile(metaPath(folderPath), 'utf8');
    return JSON.parse(data) as ProjectMeta;
  } catch {
    return null;
  }
}

export async function writeProjectMeta(folderPath: string, meta: ProjectMeta): Promise<void> {
  await fs.writeFile(metaPath(folderPath), JSON.stringify(meta, null, 2), 'utf8');
}

export async function initProjectMeta(folderPath: string): Promise<ProjectMeta> {
  const existing = await readProjectMeta(folderPath);
  if (existing) return existing;

  const id = path.basename(folderPath);
  const now = Date.now();

  const meta: ProjectMeta = {
    version: 2,
    project: {
      id,
      folderPath,
      displayName: id,
      stage: 'idea' as ResearchStage,
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    publicationTargets: [],
    milestones: [],
    smartGoals: [],
    fileIndex: [],
    lastProgressCheck: now,
  };

  await writeProjectMeta(folderPath, meta);
  return meta;
}

export async function updateProjectMeta(
  folderPath: string,
  updates: Partial<Omit<ProjectMeta, 'version'>>
): Promise<ProjectMeta> {
  const base = (await readProjectMeta(folderPath)) ?? (await initProjectMeta(folderPath));

  const updated: ProjectMeta = {
    ...base,
    ...updates,
    version: 2,
    project: {
      ...base.project,
      ...(updates.project ?? {}),
      updatedAt: Date.now(),
    },
  };

  await writeProjectMeta(folderPath, updated);
  return updated;
}

export async function hasMeta(folderPath: string): Promise<boolean> {
  try {
    await fs.access(metaPath(folderPath));
    return true;
  } catch {
    return false;
  }
}
