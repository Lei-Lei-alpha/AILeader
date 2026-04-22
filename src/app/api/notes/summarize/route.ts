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
    const { filePath, customPrompt } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
    }

    const settings = await getSettings();
    const ollamaUrl = settings.ollama_url || "http://localhost:11434";
    const ollamaModel = settings.ollama_model || "llama3";

    // Read the note content
    const content = await fs.readFile(filePath, 'utf8');

    const prompt = customPrompt || `Please provide a concise summary of the following note. Focus on key findings, decisions, and action items:\n\n${content}`;

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
    return NextResponse.json({ summary: data.response });

  } catch (error: any) {
    console.error('Summarization API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
