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
    const { messages, projectFolder } = await request.json();

    if (!projectFolder) {
      return NextResponse.json({ error: 'No project folder provided' }, { status: 400 });
    }

    const settings = await getSettings();
    const ollamaUrl = settings.ollama_url || "http://localhost:11434";
    const ollamaModel = settings.ollama_model || "llama3";

    // Format chat history into a transcript format for the LLM
    const chatTranscript = messages.map((m: any) => `${m.role.toUpperCase()}:\n${m.content}`).join('\n\n');

    const systemPrompt = `You are a strict data extraction system. The user has just finished a conversation to plan a research project. Your job is to extract the finalized plan from their chat transcript.
Output EXACTLY two blocks:
<RESEARCH_PLAN>
The detailed methodology and research plan formatted in markdown.
</RESEARCH_PLAN>
<TODO>
The actionable task list with markdown checkboxes (- [ ]).
</TODO>

Do not include any greeting or conversational text outside these tags.`;

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: `${systemPrompt}\n\n=== CHAT TRANSCRIPT ===\n${chatTranscript}`,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({ error: `Ollama API error: ${errorData}` }, { status: response.status });
    }

    const data = await response.json();
    const resultText = data.response;

    const planMatch = resultText.match(/<RESEARCH_PLAN>([\s\S]*?)<\/RESEARCH_PLAN>/);
    const todoMatch = resultText.match(/<TODO>([\s\S]*?)<\/TODO>/);

    const planContent = planMatch ? planMatch[1].trim() : resultText;
    const todoContent = todoMatch ? todoMatch[1].trim() : "- [ ] Manually extracted plan (Parsing failed somewhat).";

    // Shared Archive Logic
    let nextPrefixString = '00';
    try {
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

      await fs.writeFile(path.join(projectFolder, `${nextPrefixString}_Research_Plan.md`), planContent, 'utf8');
      await fs.writeFile(path.join(projectFolder, `${nextPrefixString}_ToDo.md`), todoContent, 'utf8');
    } catch (e) {
      console.error("Archive & commit error:", e);
      return NextResponse.json({ error: 'Failed to write files to disk' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully finalized and saved ${nextPrefixString}_Research_Plan.md and ToDo.`,
      prefixStr: nextPrefixString
    });

  } catch (error: any) {
    console.error('Commit API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
