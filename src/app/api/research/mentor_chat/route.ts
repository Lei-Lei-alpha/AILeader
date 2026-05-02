import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { search } from 'duck-duck-scrape';
import { getSettings } from '@/lib/settings';
import { readProjectMeta } from '@/lib/projectMeta';
import { chat } from '@/lib/universalLLM';
import type { MentorChatMode, LLMMessage } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { messages, contextFile, projectFolder, mode = 'mentor' } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages must be an array' }, { status: 400 });
    }

    const settings = await getSettings();
    const latestUserMessage = messages[messages.length - 1].content;

    // Load Persona Prompt based on mode
    let systemPrompt = "";
    try {
      const personaFile = mode === 'writing' ? 'writing_coach.md' 
                        : mode === 'methodology' ? 'methodology_mentor.md'
                        : mode === 'literature' ? 'literature_mentor.md'
                        : 'mentor_system.md';

      const personaData = await fs.readFile(path.join(process.cwd(), '.prompts', personaFile), 'utf8');
      systemPrompt = personaData;
    } catch (e) {
      systemPrompt = `You are a distinguished Principal Investigator and academic mentor. Your goal is to help the user polish their research ideas and refine their methodology for publication in top-tier journals.`;
    }

    // ... (keep searchContext, projectContext, noteContext, fileIndexContext logic same)


    // 1. Web Search Integration
    let searchContext = "";
    try {
      const searchResults = await search(latestUserMessage, { safeSearch: 1 as any });
      const topResults = searchResults.results.slice(0, 3);
      if (topResults.length > 0) {
        searchContext = "\n\n=== RECENT WEB SEARCH CONTEXT ===\n" + topResults.map(r => `Title: ${r.title}\nSnippet: ${r.description}\nURL: ${r.url}`).join('\n\n');
      }
    } catch (e) {
      console.error("Duck Duck Scrape error in mentor chat:", e);
    }

    // 2. Load Project Domain/Memory Context
    let projectContext = "";
    if (projectFolder) {
      try {
        const memoryPath = path.join(projectFolder, '.ai_memory.md');
        const memoryData = await fs.readFile(memoryPath, 'utf8');
        projectContext = `\n\n=== PROJECT DOMAIN MEMORY ===\n${memoryData.substring(0, 3000)}`;
      } catch (e) { /* ignore */ }
    }

    // 3. Load Active Note Context
    let noteContext = "";
    if (contextFile) {
      try {
        const content = await fs.readFile(contextFile, 'utf8');
        noteContext = `\n\n=== CURRENT NOTE / ACTIVE DOCUMENT ===\n${content.substring(0, 3000)}`;
      } catch (e) { /* ignore */ }
    }

    // 4. File index context
    let fileIndexContext = "";
    if (projectFolder) {
      try {
        const meta = await readProjectMeta(projectFolder);
        const indexed = meta?.fileIndex?.filter((e) => e.summary) ?? [];
        if (indexed.length > 0) {
          const summaryLines = indexed
            .slice(0, 12)
            .map((e) => `- **${e.relativePath}** (${e.fileType}): ${e.summary}`)
            .join('\n');
          fileIndexContext = `\n\n=== INDEXED PROJECT FILES ===\n${summaryLines}`;
        }
      } catch { /* ignore */ }
    }

    const mentorPersona = settings.mentor_persona ? `\n\nAdditional Mentor Context: The researcher is working in the field of ${settings.mentor_persona}.` : "";
    const injectedSystemPrompt = `${systemPrompt}${mentorPersona}${searchContext}${projectContext}${fileIndexContext}${noteContext}`;

    // Automatically detect `/figures/...` in messages and inject base64
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        const regex = /!\[.*?\]\(\/figures\/(.*?)\)/g;
        let match;
        while ((match = regex.exec(msg.content)) !== null) {
          const filename = match[1];
          try {
            const filepath = path.join(process.cwd(), 'public', 'figures', filename);
            const imgData = await fs.readFile(filepath);
            if (!msg.images) msg.images = [];
            msg.images.push(imgData.toString('base64'));
          } catch (e) {
            console.error("Failed to read image for LLM:", e);
          }
        }
      }
    }

    const responseContent = await chat([
      { role: 'system', content: injectedSystemPrompt },
      ...messages
    ]);

    return NextResponse.json({ message: responseContent });

  } catch (error: any) {
    console.error('Mentor Chat API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
