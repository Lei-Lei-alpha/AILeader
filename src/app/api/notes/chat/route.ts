import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { search } from 'duck-duck-scrape';

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
    const { messages, contextFile, projectFolder } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages must be an array' }, { status: 400 });
    }

    const settings = await getSettings();
    const ollamaUrl = settings.ollama_url || "http://localhost:11434";
    const ollamaModel = settings.ollama_model || "llama3";
    
    const latestUserMessage = messages[messages.length - 1].content;

    // Advanced PI System Prompt
    let systemPrompt = `You are a distinguished Principal Investigator and academic mentor. Your goal is to help the user polish their research ideas, discuss advanced math, physics, or conceptual theories, and refine their methodology for publication in top-tier (Q1) journals (e.g., Nature, Science, Cell). Be critical, scientifically rigorous, and highly actionable. Reference state-of-the-art methodology, suggest novel experiments or derivations, and push the research to the frontier.`;

    // 1. Web Search Integration
    let searchContext = "";
    try {
      const searchResults = await search(latestUserMessage, { safeSearch: 1 as any });
      const topResults = searchResults.results.slice(0, 3);
      if (topResults.length > 0) {
        searchContext = "=== RECENT WEB SEARCH CONTEXT ===\n" + topResults.map(r => `Title: ${r.title}\nSnippet: ${r.description}\nURL: ${r.url}`).join('\n\n');
      }
    } catch (e) {
      console.error("Duck Duck Scrape error in chat:", e);
    }

    // 2. Load Project Domain/Memory Context
    let projectContext = "";
    if (projectFolder) {
      try {
        const memoryPath = path.join(projectFolder, '.ai_memory.md');
        const memoryData = await fs.readFile(memoryPath, 'utf8');
        projectContext = `\n\n=== PROJECT DOMAIN MEMORY ===\n${memoryData.substring(0, 3000)}`; // limit size
      } catch (e) {
        // No memory file exists yet
      }
    }

    // 3. Load Active Note Context (if any)
    let noteContext = "";
    if (contextFile) {
      try {
        const content = await fs.readFile(contextFile, 'utf8');
        noteContext = `\n\n=== CURRENT NOTE / ACTIVE DOCUMENT ===\n${content.substring(0, 3000)}`;
      } catch (e) {
        console.error(`Error reading context file ${contextFile}:`, e);
      }
    }

    const injectedSystemPrompt = `${systemPrompt}\n\n${searchContext}${projectContext}${noteContext}`;

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { role: 'system', content: injectedSystemPrompt },
          ...messages
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({ error: `Ollama API error: ${errorData}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ message: data.message.content });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
