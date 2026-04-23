import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'settings.json');
const cachePath = path.join(process.cwd(), '.dashboard_cache.json');

async function getSettings(): Promise<any> {
  try {
    const data = await fs.readFile(settingsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { ollama_url: "http://localhost:11434", ollama_model: "llama3" };
  }
}

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

    const settings = await getSettings();
    const ollamaUrl = settings.ollama_url || "http://localhost:11434";
    const ollamaModel = settings.ollama_model || "llama3";

    // Gather task context from all folders
    let allTasksContext = "";
    for (const folder of folders) {
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

    if (!allTasksContext) {
      allTasksContext = "No active tasks found in the provided workspaces.";
    }

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

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: `${systemPrompt}\n\n=== AGGREGATED WORKSPACE CONTEXT ===${allTasksContext}`,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({ error: `Ollama API error: ${errorData}` }, { status: response.status });
    }

    const data = await response.json();
    const resultText = data.response;

    const match = resultText.match(/<DASHBOARD_JSON>([\s\S]*?)<\/DASHBOARD_JSON>/);
    let parsedTasks = [];
    if (match && match[1]) {
      try {
        parsedTasks = JSON.parse(match[1].trim());
      } catch (e) {
        console.error("JSON parse failure for dashboard:", match[1]);
        return NextResponse.json({ error: "AI failed to format JSON." }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "Missing JSON tags." }, { status: 500 });
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
