import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSettings } from '@/lib/settings';
import { readProjectMeta, writeProjectMeta } from '@/lib/projectMeta';
import { generateText } from '@/lib/universalLLM';
import type {
  ResearchMilestone,
  SMARTGoal,
  PublicationTarget,
  ProjectMeta,
} from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { folder } = await request.json();
    if (!folder) return NextResponse.json({ error: 'folder required' }, { status: 400 });

    const settings = await getSettings();

    const meta = await readProjectMeta(folder);
    if (!meta) return NextResponse.json({ error: 'No meta found' }, { status: 404 });

    // 1. Gather project context
    const memoryPath = path.join(folder, '.ai_memory.md');
    let memoryContent = '';
    try {
      memoryContent = await fs.readFile(memoryPath, 'utf8');
    } catch { /* ignore */ }

    const projectContext = [
      `Project Name: ${meta.project.displayName}`,
      `Current Stage: ${meta.project.stage}`,
      `Description: ${meta.project.description}`,
      `Files Indexed: ${meta.fileIndex.length}`,
      memoryContent ? `\nProject Memory:\n${memoryContent.substring(0, 1500)}` : '',
    ].filter(Boolean).join('\n');

    // Load and fill prompt template
    const promptTemplate = await fs.readFile(
      path.join(process.cwd(), '.prompts', 'pipeline_planner.md'),
      'utf8'
    );
    const prompt = promptTemplate.replace('{PROJECT_CONTEXT}', projectContext);

    // Call LLM
    let responseText = "";
    try {
      responseText = await generateText(prompt, { temperature: 0.2 });
    } catch (e: any) {
      return NextResponse.json({ error: `LLM error: ${e.message}` }, { status: 500 });
    }

    // Parse <PIPELINE_JSON> block
    const jsonMatch = responseText.match(/<PIPELINE_JSON>([\s\S]*?)<\/PIPELINE_JSON>/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'LLM did not return a valid <PIPELINE_JSON> block', raw: responseText.substring(0, 500) }, { status: 500 });
    }

    let parsed: {
      stageAdvance?: string | null;
      milestones?: ResearchMilestone[];
      smartGoals?: SMARTGoal[];
      publicationTargets?: Array<Omit<PublicationTarget, 'projectId'>>;
    };
    try {
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch (e) {
      return NextResponse.json({ error: 'Failed to parse pipeline JSON', raw: jsonMatch[1].substring(0, 500) }, { status: 500 });
    }

    // Merge into meta
    const updatedMeta = await readProjectMeta(folder) ?? meta;

    if (parsed.milestones) {
      const newMilestones: ResearchMilestone[] = parsed.milestones.map((m) => ({
        ...m,
        projectId: updatedMeta.project.id,
        status: m.status ?? 'pending',
        dependsOn: m.dependsOn ?? [],
        linkedFiles: m.linkedFiles ?? [],
      }));

      // Merging strategy: 
      // 1. Keep all completed/in_progress milestones
      // 2. For pending ones, if title matches a new one, replace it (to get new AI description/date)
      // 3. Add any brand new milestones
      const mergedMilestones = [...updatedMeta.milestones];
      
      for (const newM of newMilestones) {
        const existingIdx = mergedMilestones.findIndex(
          (m) => m.title.toLowerCase() === newM.title.toLowerCase() || (m.stage === newM.stage && m.status === 'pending')
        );

        if (existingIdx !== -1) {
          // Only overwrite if the existing one is pending
          if (mergedMilestones[existingIdx].status === 'pending') {
            mergedMilestones[existingIdx] = { ...newM, id: mergedMilestones[existingIdx].id }; // preserve ID
          }
        } else {
          mergedMilestones.push(newM);
        }
      }
      updatedMeta.milestones = mergedMilestones;
    }

    if (parsed.smartGoals) {
      const newGoals: SMARTGoal[] = parsed.smartGoals.map((g) => ({
        ...g,
        projectId: updatedMeta.project.id,
        status: g.status ?? 'pending',
        priority: g.priority ?? 3,
      }));

      const mergedGoals = [...updatedMeta.smartGoals];
      for (const newG of newGoals) {
        const existingIdx = mergedGoals.findIndex(
          (g) => g.title.toLowerCase() === newG.title.toLowerCase() || (g.milestoneId === newG.milestoneId && g.status === 'pending')
        );

        if (existingIdx !== -1) {
          if (mergedGoals[existingIdx].status === 'pending') {
            mergedGoals[existingIdx] = { ...newG, id: mergedGoals[existingIdx].id }; // preserve ID
          }
        } else {
          mergedGoals.push(newG);
        }
      }
      updatedMeta.smartGoals = mergedGoals;
    }

    if (parsed.publicationTargets) {
      const targets: PublicationTarget[] = parsed.publicationTargets.map((t) => ({
        ...t,
        projectId: updatedMeta.project.id,
      }));
      const existingVenueIds = new Set(updatedMeta.publicationTargets.map((t) => t.targetVenue));
      const newTargets = targets.filter((t) => !existingVenueIds.has(t.targetVenue));
      updatedMeta.publicationTargets = [...updatedMeta.publicationTargets, ...newTargets];
    }

    if (parsed.stageAdvance) {
      updatedMeta.project.stage = parsed.stageAdvance as any;
    }

    updatedMeta.project.updatedAt = Date.now();
    await writeProjectMeta(folder, updatedMeta);

    return NextResponse.json({ success: true, meta: updatedMeta });

  } catch (error: any) {
    console.error('Pipeline API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { folder, type, id, updates } = await request.json();
    if (!folder || !type || !id || !updates) {
      return NextResponse.json({ error: 'folder, type, id, and updates are required' }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings.folders?.includes(folder)) {
      return NextResponse.json({ error: 'Folder not registered' }, { status: 403 });
    }

    const meta = await readProjectMeta(folder);
    if (!meta) return NextResponse.json({ error: 'No meta found' }, { status: 404 });

    if (type === 'milestone') {
      const idx = meta.milestones.findIndex((m) => m.id === id);
      if (idx === -1) {
        meta.milestones.push({ ...updates, id, projectId: meta.project.id });
      } else {
        meta.milestones[idx] = { ...meta.milestones[idx], ...updates };
      }
    } else if (type === 'goal') {
      const idx = meta.smartGoals.findIndex((g) => g.id === id);
      if (idx === -1) {
        meta.smartGoals.push({ ...updates, id, projectId: meta.project.id });
      } else {
        meta.smartGoals[idx] = { ...meta.smartGoals[idx], ...updates };
      }
    } else if (type === 'target') {
      const idx = meta.publicationTargets.findIndex((t) => t.id === id);
      if (idx === -1) {
        meta.publicationTargets.push({ ...updates, id, projectId: meta.project.id });
      } else {
        meta.publicationTargets[idx] = { ...meta.publicationTargets[idx], ...updates };
      }
    } else if (type === 'project') {
      meta.project = { ...meta.project, ...updates };
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    meta.project.updatedAt = Date.now();
    await writeProjectMeta(folder, meta);
    return NextResponse.json({ success: true, meta });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { folder, type, id } = await request.json();
    if (!folder || !type || !id) {
      return NextResponse.json({ error: 'folder, type, and id are required' }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings.folders?.includes(folder)) {
      return NextResponse.json({ error: 'Folder not registered' }, { status: 403 });
    }

    const meta = await readProjectMeta(folder);
    if (!meta) return NextResponse.json({ error: 'No meta found' }, { status: 404 });

    if (type === 'milestone') {
      meta.milestones = meta.milestones.filter((m) => m.id !== id);
      meta.smartGoals = meta.smartGoals.filter((g) => g.milestoneId !== id);
    } else if (type === 'goal') {
      meta.smartGoals = meta.smartGoals.filter((g) => g.id !== id);
    } else if (type === 'target') {
      meta.publicationTargets = meta.publicationTargets.filter((t) => t.id !== id);
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    meta.project.updatedAt = Date.now();
    await writeProjectMeta(folder, meta);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
