import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'settings.json');

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
    const { files } = await request.json();
    const settings = await getSettings();
    const ollamaUrl = settings.ollama_url || "http://localhost:11434";
    const ollamaModel = settings.ollama_model || "llama3";

    let tasksContext = "";

    if (files && Array.isArray(files)) {
      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          tasksContext += `\nFile: ${path.basename(filePath)}\n${content}\n`;
        } catch (e) {
          console.error(`Error reading file ${filePath}:`, e);
        }
      }
    } else {
      // Default: scan the 'to_do' folder in the current working directory
      const todoDir = path.join(process.cwd(), 'to_do');
      try {
        const items = await fs.readdir(todoDir);
        for (const item of items) {
          if (item.endsWith('.md')) {
            const content = await fs.readFile(path.join(todoDir, item), 'utf8');
            tasksContext += `\nFile: ${item}\n${content}\n`;
          }
        }
      } catch (e) {
        console.error(`Error reading to_do directory:`, e);
        return NextResponse.json({ error: 'Could not find or read to_do folder' }, { status: 500 });
      }
    }

    if (!tasksContext) {
      return NextResponse.json({ error: 'No tasks found to plan' }, { status: 400 });
    }

    const prompt = `You are an AI Project Manager. Below are lists of tasks from various project files. 
Please analyze them and create a prioritized daily plan. 
1. Group tasks by project/file.
2. Prioritize them based on logical dependency and urgency (infer urgency from the content).
3. Provide a clear, actionable list for today.
4. Briefly explain why you prioritized certain tasks over others.

Tasks:
${tasksContext}`;

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({ error: `Ollama API error: ${errorData}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ plan: data.response });

  } catch (error: any) {
    console.error('Planning API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
