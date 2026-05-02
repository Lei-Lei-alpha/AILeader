import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { search } from 'duck-duck-scrape';
import { getSettings } from '@/lib/settings';
import { generateText } from '@/lib/universalLLM';

const promptPath = path.join(process.cwd(), '.prompts', 'AI_plan_research_project.md');

export async function POST(request: Request) {
  try {
    const { folderPath, timeFrame, attachedDocsText } = await request.json();
    
    if (!folderPath) {
      return NextResponse.json({ error: 'No folderPath provided' }, { status: 400 });
    }

    const settings = await getSettings();

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

    const resultText = await generateText(fullPrompt, { temperature: 0.7 });

    // Append to memory
    try {
      const memoryEntry = `\n\n## Generation on ${new Date().toISOString()}\nTarget Timeframe: ${timeFrame}\nSummary of Output:\n... Draft Conversation Started ...\n`;
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
