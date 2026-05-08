import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSettings } from '@/lib/settings';
import { readProjectMeta } from '@/lib/projectMeta';
import { chat } from '@/lib/universalLLM';
import type { LLMMessage } from '@/lib/universalLLM';

// ── Section definitions ───────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'outline',       label: 'Paper Outline',        targetWords: 400,  internal: true },
  { id: 'title',         label: 'Title & Abstract',      targetWords: 280,  internal: false },
  { id: 'introduction',  label: 'Introduction',          targetWords: 650,  internal: false },
  { id: 'related_work',  label: 'Related Work',          targetWords: 550,  internal: false },
  { id: 'methodology',   label: 'Methodology',           targetWords: 750,  internal: false },
  { id: 'results',       label: 'Results & Analysis',    targetWords: 650,  internal: false },
  { id: 'discussion',    label: 'Discussion',            targetWords: 450,  internal: false },
  { id: 'conclusion',    label: 'Conclusion',            targetWords: 280,  internal: false },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

// ── Section prompts ───────────────────────────────────────────────────────────

function buildSectionPrompt(
  sectionId: SectionId,
  context: string,
  outline: string,
  previous: Record<string, string>,
  targetWords: number,
  journalTarget: string,
): string {
  const prevText = Object.entries(previous)
    .filter(([k]) => k !== 'outline')
    .map(([k, v]) => `=== ${k.toUpperCase()} ===\n${v}`)
    .join('\n\n');

  const base = `${context}\n\n=== PAPER OUTLINE ===\n${outline}${prevText ? `\n\n=== PREVIOUSLY WRITTEN SECTIONS ===\n${prevText}` : ''}`;

  const instructions: Record<string, string> = {
    outline: `Generate a detailed paper outline for a ${journalTarget || 'Q1 journal'} submission.
Include: working title, 3–5 bullet-point key contributions, section structure with 2–3 bullet-point topics per section, figure/table plan (list intended display items), and 2–3 sentence description of the central narrative arc.
Target: ${targetWords} words.`,

    title: `Write the paper title and abstract.

FORMAT (output exactly this structure):
# [Paper Title]

## Abstract
[Abstract text — ${targetWords} words, structured as: background sentence, problem/gap, approach, key result with a number if possible, significance/impact]

Journal target: ${journalTarget || 'Q1 journal'}`,

    introduction: `Write the Introduction section (## Introduction).
Structure: (1) broad field context and importance (2–3 sentences), (2) specific problem and why existing approaches fall short (3–4 sentences), (3) your approach and key idea (2–3 sentences), (4) list of concrete contributions (bullet points or numbered), (5) brief paper structure roadmap (1–2 sentences).
Target: ${targetWords} words. Journal: ${journalTarget || 'Q1 journal'}.`,

    related_work: `Write the Related Work section (## Related Work).
Organise into 2–3 thematic sub-sections using ### headings. For each theme: summarise state of the art, identify limitations, and explain how this work addresses them. End with a paragraph that positions this work relative to the closest prior work.
Base citations on the FILE_SUMMARIES and AI_MEMORY provided. Use [AuthorYear] placeholders where specific references are unavailable.
Target: ${targetWords} words.`,

    methodology: `Write the Methodology section (## Methodology).
Include: (1) overall framework/architecture overview with a mention of any key figure, (2) detailed description of each method component with sub-sections (### headings), (3) implementation details (datasets, hyperparameters, tools, platforms) where available from the project files, (4) any theoretical derivations or proofs (use LaTeX-style math in $...$ if relevant).
Be precise and reproducible. Target: ${targetWords} words.`,

    results: `Write the Results & Analysis section (## Results & Analysis).
Structure: (1) experimental/evaluation setup summary (1 short paragraph), (2) main results with quantitative comparisons (reference figures/tables from the FIGURES list if available), (3) ablation or sensitivity analysis if data supports it, (4) qualitative insights.
Make quantitative claims where the data supports them. Target: ${targetWords} words.`,

    discussion: `Write the Discussion section (## Discussion).
Cover: (1) interpretation of key results — what do they mean scientifically?, (2) connection back to the motivation/gap from the Introduction, (3) unexpected findings and possible explanations, (4) limitations of the study (be honest but not self-defeating), (5) broader implications for the field.
Target: ${targetWords} words.`,

    conclusion: `Write the Conclusion section (## Conclusion).
Structure: (1) one-paragraph summary of the work and key findings (do NOT repeat the abstract verbatim), (2) broader impact statement (2–3 sentences), (3) future work directions (3–5 specific, actionable items as bullet points).
End with a strong, memorable closing sentence about the long-term significance of this work.
Target: ${targetWords} words.`,
  };

  return `${base}\n\n=== YOUR TASK ===\n${instructions[sectionId]}`;
}

// ── Context builder ───────────────────────────────────────────────────────────

async function buildProjectContext(folder: string, journalTarget: string, writingStyle: string): Promise<string> {
  const meta = await readProjectMeta(folder);
  const projectName = meta?.project.displayName || path.basename(folder);
  const today = new Date().toISOString().split('T')[0];

  // File index summaries
  const fileSummaries = (meta?.fileIndex ?? [])
    .filter((f) => f.summary)
    .slice(0, 15)
    .map((f) => `- **${f.relativePath}** (${f.fileType}): ${f.summary}${f.keywords.length ? ` [${f.keywords.join(', ')}]` : ''}`)
    .join('\n');

  // AI memory
  let memory = '';
  try { memory = (await fs.readFile(path.join(folder, '.ai_memory.md'), 'utf8')).substring(0, 3000); } catch { /* ignore */ }

  // Latest research plan
  let researchPlan = '';
  try {
    const files = (await fs.readdir(folder)).filter((f) => f.match(/^\d{2}_Research_Plan\.md$/)).sort();
    if (files.length > 0) {
      researchPlan = (await fs.readFile(path.join(folder, files[files.length - 1]), 'utf8')).substring(0, 2500);
    }
  } catch { /* ignore */ }

  // Figures
  let figuresList = '';
  try {
    const figDir = path.join(folder, 'figures');
    const figFiles = await fs.readdir(figDir).catch(() => []);
    const publicFigFiles = await fs.readdir(path.join(process.cwd(), 'public', 'figures')).catch(() => []);
    const allFigs = [...figFiles, ...publicFigFiles].filter((f) => /\.(png|jpg|jpeg|svg|pdf)$/i.test(f));
    if (allFigs.length > 0) figuresList = `\n\nAvailable figures: ${allFigs.join(', ')}`;
  } catch { /* ignore */ }

  // Completed milestones as evidence of progress
  const doneMilestones = (meta?.milestones ?? [])
    .filter((m) => m.status === 'completed')
    .map((m) => `✓ ${m.title}`)
    .join('\n');

  return [
    `PROJECT_CONTEXT:`,
    `Project: ${projectName}`,
    `Date: ${today}`,
    `Stage: ${meta?.project.stage || 'unknown'}`,
    meta?.project.description ? `Description: ${meta.project.description}` : '',
    `Target Journal/Venue: ${journalTarget || 'Q1 Journal (unspecified)'}`,
    writingStyle ? `Writing Style Notes: ${writingStyle}` : '',
    figuresList,
    fileSummaries ? `\n\nFILE_SUMMARIES:\n${fileSummaries}` : '',
    memory ? `\n\nAI_MEMORY (literature analysis & notes):\n${memory}` : '',
    researchPlan ? `\n\nRESEARCH_PLAN (excerpt):\n${researchPlan}` : '',
    doneMilestones ? `\n\nCOMPLETED_MILESTONES:\n${doneMilestones}` : '',
  ].filter(Boolean).join('\n');
}

// ── Streaming POST ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { folder, journalTarget = '', writingStyle = '' } = await request.json();

  if (!folder) {
    return NextResponse.json({ error: 'folder is required' }, { status: 400 });
  }

  const settings = await getSettings();
  if (!settings.folders?.includes(folder)) {
    return NextResponse.json({ error: 'Folder not registered' }, { status: 403 });
  }

  // Load system prompt
  let systemPrompt = '';
  try {
    systemPrompt = await fs.readFile(path.join(process.cwd(), '.prompts', 'paper_orchestra.md'), 'utf8');
  } catch {
    systemPrompt = 'You are an expert academic writer. Write precise, publication-quality research paper sections.';
  }

  // Pre-build context (expensive — do once, reuse for all sections)
  const projectContext = await buildProjectContext(folder, journalTarget, writingStyle);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const visibleSections = SECTIONS.filter((s) => !s.internal);
        send({ event: 'start', sections: visibleSections.map((s) => ({ id: s.id, label: s.label })) });

        const written: Record<string, string> = {};

        for (const section of SECTIONS) {
          send({ event: 'section_start', section: section.id, label: section.label });

          const userPrompt = buildSectionPrompt(
            section.id,
            projectContext,
            written.outline || '',
            written,
            section.targetWords,
            journalTarget,
          );

          const messages: LLMMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ];

          const content = await chat(messages, { temperature: 0.4 });
          written[section.id] = content.trim();

          send({ event: 'section_done', section: section.id, content: written[section.id] });
        }

        // Assemble full paper
        const titleBlock = written.title || '';
        const bodyBlocks = SECTIONS
          .filter((s) => !s.internal && s.id !== 'title')
          .map((s) => written[s.id] || '')
          .join('\n\n---\n\n');

        const fullPaper = [
          titleBlock,
          '\n\n---\n\n',
          bodyBlocks,
          `\n\n---\n\n*Generated by PaperOrchestra · ${new Date().toLocaleDateString()} · ${journalTarget || 'Research Mentor'}*`,
        ].join('');

        // Save to project folder
        const dateStr = new Date().toISOString().slice(0, 10);
        const safeJournal = journalTarget ? `_${journalTarget.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}` : '';
        const filename = `PaperOrchestra${safeJournal}_${dateStr}.md`;
        const savePath = path.join(folder, filename);
        await fs.writeFile(savePath, fullPaper, 'utf8');

        const wordCount = fullPaper.split(/\s+/).filter(Boolean).length;
        send({ event: 'complete', filePath: savePath, filename, wordCount, paper: fullPaper });
      } catch (err: any) {
        send({ event: 'error', message: err.message || 'An error occurred during paper generation' });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
