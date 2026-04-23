import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { search } from 'duck-duck-scrape';

const settingsPath = path.join(process.cwd(), 'settings.json');
const promptPath = path.join(process.cwd(), 'prompts', 'AI_plan_research_project.md');

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
    const { folderPath, timeFrame, attachedDocsText } = await request.json();
    
    if (!folderPath) {
      return NextResponse.json({ error: 'No folderPath provided' }, { status: 400 });
    }

    const settings = await getSettings();
    const ollamaUrl = settings.ollama_url || "http://localhost:11434";
    const ollamaModel = settings.ollama_model || "llama3";

    let tasksContext = "";
    let systemPrompt = "";

    // Load default prompt
    try {
      systemPrompt = await fs.readFile(promptPath, 'utf8');
    } catch (e) {
      systemPrompt = `You are an AI planner. Output SMART tasks and <CALENDAR_JSON>[...]</CALENDAR_JSON> array at the end.`;
    }

    // Read all MD files in the folder
    let folderContents = "";
    try {
      const items = await fs.readdir(folderPath);
      for (const item of items) {
        if (item.endsWith('.md') && item !== '.ai_memory.md') {
          const content = await fs.readFile(path.join(folderPath, item), 'utf8');
          folderContents += `\n--- File: ${item} ---\n${content.substring(0, 5000)}\n`; // Limit size to avoid context overflow
        }
      }
    } catch (e) {
      console.error(`Error reading directory ${folderPath}:`, e);
      return NextResponse.json({ error: 'Could not read research project directory.' }, { status: 500 });
    }

    // Read Memory
    const memoryPath = path.join(folderPath, '.ai_memory.md');
    let memoryContents = "";
    try {
      memoryContents = await fs.readFile(memoryPath, 'utf8');
    } catch (e) {
      memoryContents = "No previous memory stored for this project.";
    }

    // Web Search Integration
    const searchTerms = `${path.basename(folderPath)} research review latest state of the art`;
    let searchResultsStr = "";
    try {
      const searchResults = await search(searchTerms, { safeSearch: 1 as any }); // enum mismatch workaround
      const topResults = searchResults.results.slice(0, 3);
      searchResultsStr = topResults.map(r => `Title: ${r.title}\nSnippet: ${r.description}\nURL: ${r.url}`).join('\n\n');
    } catch (e) {
      console.error("Duck Duck Scrape error:", e);
      searchResultsStr = "Web search failed.";
    }

    // Prepare Prompt
    const fullPrompt = `${systemPrompt}

Project Name/Dir: ${path.basename(folderPath)}
Requested Time Frame: ${timeFrame || "Not specified"}

=== PREVIOUS MEMORY / PROGRESS ===
${memoryContents}

=== WEBS SEARCH CONTEXT: "${searchTerms}" ===
${searchResultsStr}

=== ATTACHED DOCUMENTS / CONTEXT ===
${attachedDocsText || "No attached documents."}

=== RESEARCH NOTES EXTRACTED ===
${folderContents || "No notes found in folder."}

Please generate the Research Plan and the <CALENDAR_JSON> data!`;

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: fullPrompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({ error: `Ollama API error: ${errorData}` }, { status: response.status });
    }

    const data = await response.json();
    const resultText = data.response;

    // Archive existing files and get next prefix
    let nextPrefixString = '00';
    try {
      const archivePath = path.join(folderPath, '.archive');
      await fs.mkdir(archivePath, { recursive: true }).catch(() => {});
      
      const files = await fs.readdir(folderPath);
      let maxPrefix = -1;

      for (const file of files) {
        const match = file.match(/^(\d{2})_(Research_Plan\.md|ToDo\.md)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxPrefix) maxPrefix = num;
          // Move to archive
          await fs.rename(path.join(folderPath, file), path.join(archivePath, file)).catch((e) => console.error('Rename fail', e));
        }
      }

      const nextPrefixNum = maxPrefix === -1 ? 0 : maxPrefix + 1;
      nextPrefixString = nextPrefixNum.toString().padStart(2, '0');
    } catch (e) {
      console.error("Archive logic error:", e);
    }

    // Attempt to split LLM output into Plan and ToDo, or just write it whole.
    // We will dump the generated plan to XX_Research_Plan.md and a placeholder/checklist into XX_ToDo.md
    try {
      await fs.writeFile(path.join(folderPath, `${nextPrefixString}_Research_Plan.md`), resultText, 'utf8');
      
      // Auto-extract tasks if we can, else just put a notice
      let todoContent = `# ${nextPrefixString} ToDo List\n\nPlease check the AI chat or Research Plan for specific tasks and manage them here.`;
      const calRegex = /<CALENDAR_JSON>([\s\S]*?)<\/CALENDAR_JSON>/;
      const match = resultText.match(calRegex);
      if (match && match[1]) {
        try {
          const tasks = JSON.parse(match[1].trim());
          todoContent = `# Generated ToDo List\n\n`;
          tasks.forEach((t: any) => {
            todoContent += `- [ ] **${t.title}** (Target: ${new Date(t.start).toLocaleDateString()})\n      ${t.description}\n`;
          });
        } catch (e) {}
      }
      await fs.writeFile(path.join(folderPath, `${nextPrefixString}_ToDo.md`), todoContent, 'utf8');
    } catch (e) {
      console.error("Failed to write plan/todo files:", e);
    }

    // Append to memory
    try {
      const memoryEntry = `\n\n## Generation on ${new Date().toISOString()}\nTarget Timeframe: ${timeFrame}\nSummary of Output:\n... Plan Generated as ${nextPrefixString} version ...\n`;
      await fs.appendFile(memoryPath, memoryEntry, 'utf8');
    } catch (e) {
      console.error("Failed to write memory:", e);
    }

    return NextResponse.json({ plan: resultText });

  } catch (error: any) {
    console.error('Planning API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
