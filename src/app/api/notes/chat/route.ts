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
    let systemPrompt = `You are a distinguished Principal Investigator and academic mentor. Your goal is to help the user polish their research ideas, discuss advanced math, physics, or conceptual theories, and refine their methodology for publication in top-tier (Q1) journals (e.g., Nature, Science, Cell). Be critical, scientifically rigorous, and highly actionable. Reference state-of-the-art methodology, suggest novel experiments or derivations, and push the research to the frontier.

CRITICAL INSTRUCTION:
If you and the user agree to update the formal research plan or the to-do list based on the chat, you MUST output the completely updated markdown content wrapped inside <UPDATE_PLAN>...</UPDATE_PLAN> for the plan, or <UPDATE_TODO>...</UPDATE_TODO> for the to-do list. The system will automatically overwrite the physical files for the user if you include these tags.`;

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
    let resultText = data.message.content;

    // Check for file update tags
    if (projectFolder) {
      try {
        const planMatch = resultText.match(/<UPDATE_PLAN>([\s\S]*?)<\/UPDATE_PLAN>/);
        const todoMatch = resultText.match(/<UPDATE_TODO>([\s\S]*?)<\/UPDATE_TODO>/);

        if (planMatch || todoMatch) {
          // Shared Archive Logic
          let nextPrefixString = '00';
          const archivePath = path.join(projectFolder, '.archive');
          await fs.mkdir(archivePath, { recursive: true }).catch(() => {});
          
          const files = await fs.readdir(projectFolder);
          let maxPrefix = -1;

          for (const file of files) {
            const match = file.match(/^(\d{2})_(Research_Plan\.md|ToDo\.md)$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxPrefix) maxPrefix = num;
              // Move to archive
              await fs.rename(path.join(projectFolder, file), path.join(archivePath, file)).catch(() => {});
            }
          }
          const nextPrefixNum = maxPrefix === -1 ? 0 : maxPrefix + 1;
          nextPrefixString = nextPrefixNum.toString().padStart(2, '0');

          if (planMatch) {
            await fs.writeFile(path.join(projectFolder, `${nextPrefixString}_Research_Plan.md`), planMatch[1].trim(), 'utf8');
            resultText = resultText.replace(/<UPDATE_PLAN>[\s\S]*?<\/UPDATE_PLAN>/, `\n\n*(Successfully generated and saved new version: \`${nextPrefixString}_Research_Plan.md\`)*\n`);
          }
          if (todoMatch) {
            await fs.writeFile(path.join(projectFolder, `${nextPrefixString}_ToDo.md`), todoMatch[1].trim(), 'utf8');
            resultText = resultText.replace(/<UPDATE_TODO>[\s\S]*?<\/UPDATE_TODO>/, `\n\n*(Successfully generated and saved new version: \`${nextPrefixString}_ToDo.md\`)*\n`);
          }
        }
      } catch (e) {
        console.error("Failed to parse/update files from chat:", e);
      }
    }

    return NextResponse.json({ message: resultText });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
