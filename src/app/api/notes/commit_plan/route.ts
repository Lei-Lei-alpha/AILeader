import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSettings } from '@/lib/settings';
import { initProjectMeta } from '@/lib/projectMeta';
import { generateText } from '@/lib/universalLLM';

export async function POST(request: Request) {
  try {
    const { messages, projectFolder } = await request.json();

    if (!projectFolder) {
      return NextResponse.json({ error: 'No project folder provided' }, { status: 400 });
    }

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

    const resultText = await generateText(`${systemPrompt}\n\n=== CHAT TRANSCRIPT ===\n${chatTranscript}`);

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

    // Ensure .research_meta.json exists and advance stage if plan keywords suggest it
    try {
      const meta = await initProjectMeta(projectFolder);
      const combinedText = (planContent + ' ' + todoContent).toLowerCase();

      // Detect stage advancement keywords in the committed plan
      const stageKeywords: Array<{ stage: string; keywords: string[] }> = [
        { stage: 'literature_review', keywords: ['literature review', 'related work', 'prior art', 'survey', 'systematic review'] },
        { stage: 'methodology', keywords: ['methodology', 'experimental design', 'research design', 'framework', 'model design'] },
        { stage: 'experiments', keywords: ['experiment', 'simulation', 'data collection', 'prototype', 'implementation', 'benchmark'] },
        { stage: 'writing', keywords: ['manuscript', 'writing', 'draft', 'paper structure', 'abstract', 'introduction section'] },
        { stage: 'submission', keywords: ['submission', 'submit to', 'journal submission', 'conference submission', 'arxiv'] },
        { stage: 'revision', keywords: ['revision', 'reviewer comments', 'rebuttal', 'revise and resubmit'] },
        { stage: 'published', keywords: ['published', 'accepted', 'in press', 'doi:'] },
      ];

      const STAGE_ORDER = ['idea', 'literature_review', 'methodology', 'experiments', 'writing', 'submission', 'revision', 'published'];
      const currentIdx = STAGE_ORDER.indexOf(meta.project.stage);
      let bestStageIdx = currentIdx;

      for (const { stage, keywords } of stageKeywords) {
        const idx = STAGE_ORDER.indexOf(stage);
        if (idx > bestStageIdx && keywords.some((kw) => combinedText.includes(kw))) {
          bestStageIdx = idx;
        }
      }

      if (bestStageIdx > currentIdx) {
        const { updateProjectMeta } = await import('@/lib/projectMeta');
        await updateProjectMeta(projectFolder, {
          project: { ...meta.project, stage: STAGE_ORDER[bestStageIdx] as any, updatedAt: Date.now() },
        });
      }
    } catch (e) {
      console.warn('Failed to init/update project meta:', e);
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
