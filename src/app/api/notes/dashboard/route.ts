import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSettings, DASHBOARD_CACHE_PATH } from '@/lib/settings';
import { generateText } from '@/lib/universalLLM';

const cachePath = DASHBOARD_CACHE_PATH;

export async function POST(request: Request) {
  try {
    const { folders, force } = await request.json();

    if (!folders || !Array.isArray(folders)) {
      return NextResponse.json({ error: 'Folders array requested' }, { status: 400 });
    }

    if (!force) {
      try {
        const cacheData = await fs.readFile(cachePath, 'utf8');
        const cache = JSON.parse(cacheData);
        if (cache && cache.last_updated && (Date.now() - cache.last_updated < 7 * 24 * 60 * 60 * 1000)) {
          return NextResponse.json({ tasks: cache.tasks });
        }
      } catch (e) {
        // Cache misses naturally fail silently and compute via Ollama
      }
    }

    // Gather task context from all folders
    let allTasksContext = "";
    let directMetaTasks: any[] = [];

    for (const folder of folders) {
      // Try to read .research_meta.json for structured tasks
      try {
        const metaPath = path.join(folder, ".research_meta.json");
        const metaContent = await fs.readFile(metaPath, 'utf8');
        const meta = JSON.parse(metaContent);
        
        if (meta.smartGoals && Array.isArray(meta.smartGoals)) {
          for (const goal of meta.smartGoals) {
            directMetaTasks.push({
              id: goal.id,
              source_folder: folder,
              source_file: ".research_meta.json",
              project: meta.project?.displayName || path.basename(folder),
              title: `[Goal] ${goal.title}`,
              start: goal.timeBound,
              end: goal.timeBound,
              importance: goal.priority ? (6 - goal.priority) : 3, // Convert 1-5 (1 high) to 1-5 (5 high)
              urgency: 3,
              status: goal.status === 'done' ? 'done' : 'pending',
              smartGoalId: goal.id
            });
          }
        }
        
        if (meta.milestones && Array.isArray(meta.milestones)) {
          for (const m of meta.milestones) {
            if (m.status === 'completed') continue; // Don't clutter with old milestones
            directMetaTasks.push({
              id: m.id,
              source_folder: folder,
              source_file: ".research_meta.json",
              project: meta.project?.displayName || path.basename(folder),
              title: `[Milestone] ${m.title}`,
              start: m.dueDate,
              end: m.dueDate,
              importance: 4,
              urgency: 4,
              status: m.status === 'completed' ? 'done' : 'pending',
              milestoneId: m.id,
              stage: m.stage
            });
          }
        }
      } catch (e) {
        // Meta might not exist yet, skip
      }

      try {
        const files = await fs.readdir(folder);
        // Only look at main ToDo and Research_Plan files, ignoring .archive
        for (const file of files) {
          if (file.endsWith('_ToDo.md') || file.endsWith('_Research_Plan.md')) {
            const content = await fs.readFile(path.join(folder, file), 'utf8');
            // Check if there are checklist items or calendar tasks
            if (content.includes('- [ ]') || content.includes('<CALENDAR_JSON>')) {
               allTasksContext += `\n\n--- PROJECT FOLDER: ${path.basename(folder)} | FILE: ${file} ---\n`;
               allTasksContext += content.substring(0, 5000); // limit to prevent explosion
            }
          }
        }
      } catch (e) {
        console.error(`Failed to read folder tasks in ${folder}:`, e);
      }
    }

    if (!allTasksContext && directMetaTasks.length === 0) {
      return NextResponse.json({ tasks: [] });
    }

    let parsedTasks = [...directMetaTasks];

    if (allTasksContext) {
      const systemPrompt = `You are a strict task prioritization and extraction system. The user wants a global view of every task from all their research projects.
I have appended chunks of their To-Do lists and research plans below.
Your job is to read all of these implicit and explicit tasks, evaluate their importance and urgency (both on a scale of 1-5 where 5 is highest), and return ONLY a valid JSON array wrapped precisely inside <DASHBOARD_JSON>...</DASHBOARD_JSON>.

Each object in the JSON array MUST have the exact following shape:
{
  "id": "unique-task-string",
  "source_folder": "The absolute path of the folder exactly as provided in the context demarcations",
  "source_file": "The specific markdown filename exactly as provided in the context demarcations",
  "project": "Name of project extracted from context",
  "title": "Clear task description exactly as written continuously on the checkbox line",
  "start": "YYYY-MM-DD",
  "end": "YYYY-MM-DD",
  "importance": number between 1 and 5,
  "urgency": number between 1 and 5,
  "status": "pending" or "done" based on if checked [x] or [ ]
}

If start/end dates are not explicitly written, infer logical dates based on the sequence within the research plan logic, placing them into a theoretical timeframe spanning the upcoming 3 months. Do NOT output anything outside the <DASHBOARD_JSON> tags.`;

      try {
        const resultText = await generateText(`${systemPrompt}\n\n=== AGGREGATED WORKSPACE CONTEXT ===${allTasksContext}`, {
          temperature: 0.2
        });

        const match = resultText.match(/<DASHBOARD_JSON>([\s\S]*?)<\/DASHBOARD_JSON>/);
        if (match && match[1]) {
          try {
            const extracted = JSON.parse(match[1].trim());
            parsedTasks = [...parsedTasks, ...extracted];
          } catch (e) {
            console.error("JSON parse failure for dashboard:", match[1]);
          }
        }
      } catch (e) {
        console.error("LLM generation error in dashboard:", e);
      }
    }

    // Sort heavily by Score (Urgency + Importance)
    parsedTasks.sort((a: any, b: any) => (b.importance + b.urgency) - (a.importance + a.urgency));

    try {
      await fs.writeFile(cachePath, JSON.stringify({ last_updated: Date.now(), tasks: parsedTasks }), 'utf8');
    } catch(e) {
      console.warn("Failed to write dashboard cache", e);
    }

    return NextResponse.json({ tasks: parsedTasks });

  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
