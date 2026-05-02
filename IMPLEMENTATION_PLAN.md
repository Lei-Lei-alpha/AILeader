# Researcher Mentor — Implementation Plan

## Overview

Transform AILeader (Next.js 13.5 + Ollama + file-system storage) into a **Researcher Mentor** system
for managing multiple research projects from idea to publication.

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Metadata storage | `.research_meta.json` per project folder | Zero new infra, self-contained, co-locates with files |
| LLM backend | Ollama `/api/generate` + `/api/chat` | Already wired; JSON tasks use `temperature: 0.2` |
| Component strategy | Extract from monolith first, then add | Safe incremental; no big-bang rewrite |
| Progress detection | `fs.stat mtimeMs` polling (30s) | No `chokidar` dependency needed |
| File indexing | Reuse existing PDF/DOCX/OCR extraction | Avoids duplicating parsing logic |

---

## New Data Models (`src/lib/types.ts`)

```
ResearchProject       — stage, description, dates, tags
PublicationTarget     — output type (paper/grant/dataset), venue, deadline, status
ResearchMilestone     — stage-linked, with dependencies and linked files
SMARTGoal             — Specific/Measurable/Achievable/Relevant/TimeBound
FileIndexEntry        — extracted text + LLM summary + keywords per file
ProgressNotification  — milestone due, file updated, stage advance events
ProjectMeta           — root wrapper written to .research_meta.json
```

---

## Publication Pipeline (8 stages)

```
idea → literature_review → methodology → experiments → writing → submission → revision → published
```

Each stage gets auto-generated milestones and SMART goals from the LLM after file indexing.

---

## Phase 1 — Foundation (CURRENT)

**Goal:** Clean architecture, shared libs, project metadata persistence.

### Files Created
- `src/lib/types.ts` — all new TypeScript interfaces
- `src/lib/settings.ts` — shared `getSettings()`, `AppSettings` (replaces 8 duplicates)
- `src/lib/projectMeta.ts` — `readProjectMeta`, `writeProjectMeta`, `initProjectMeta`, `updateProjectMeta`
- `src/lib/ollamaClient.ts` — `ollamaGenerate()`, `ollamaChat()` helpers
- `src/app/api/research/meta/route.ts` — GET + POST for `.research_meta.json`
- `src/components/Dashboard.tsx` — self-contained task dashboard (Gantt/Calendar/Todo + Pomodoro)
- `src/components/AiPanel.tsx` — AI assistant panel with resize, chat, doc upload
- `src/components/Sidebar.tsx` — sidebar with search, folder tree, modals

### Files Modified
- `src/app/page.tsx` — reduced from 1,667 → ~600 lines using new components
- `src/app/api/notes/chat/route.ts` — use `src/lib/settings.ts`
- `src/app/api/notes/plan/route.ts` — use `src/lib/settings.ts`
- `src/app/api/notes/commit_plan/route.ts` — use `src/lib/settings.ts`
- `src/app/api/notes/dashboard/route.ts` — use `src/lib/settings.ts`
- `src/app/api/settings/route.ts` — use `src/lib/settings.ts`, add `mentor_persona`
- `src/app/api/folders/route.ts` — use `src/lib/settings.ts`

---

## Phase 2 — File Indexing + Literature Analysis

**Goal:** LLM reads and reasons over all uploaded project files.

### Files to Create
- `src/lib/fileIndexer.ts` — scan folder, extract text, call Ollama for summaries + keywords
- `src/app/api/research/index/route.ts` — incremental indexing (skip unchanged by mtimeMs)
- `src/app/api/research/analyze_literature/route.ts` — cross-file theme/gap/citation analysis
- `src/components/FileIndexStatus.tsx` — editor header status bar ("X files need indexing")
- `prompts/literature_analysis.md` — structured lit-review prompt

### Files to Modify
- `src/components/AiPanel.tsx` — inject fileIndex summaries as context automatically
- `src/components/Sidebar.tsx` — add "Index Files" to folder context menu

---

## Phase 3 — Publication Pipeline + SMART Goals

**Goal:** Visual idea-to-publication stage tracker with milestones and goals.

### Files to Create
- `src/app/api/research/pipeline/route.ts` — LLM generates milestones and SMART goals
- `src/components/ResearchPipelineView.tsx` — horizontal stage track with milestone cards
- `src/components/MilestoneDetailPanel.tsx` — slide-in milestone editor with "Ask Mentor" button
- `src/components/GoalOutputManager.tsx` — publication target table linked to SMART goals
- `prompts/pipeline_planner.md` — structured pipeline generation prompt

### Files to Modify
- `src/app/api/notes/commit_plan/route.ts` — advance `project.stage` on commit
- `src/app/page.tsx` — add Pipeline button, pipeline open/close state

---

## Phase 4 — Mentor Chat Modes

**Goal:** 4 specialized chat modes: Mentor / Literature / Methodology / Writing.

### Files to Create
- `src/app/api/research/mentor_chat/route.ts` — mode-aware routing with specialized prompts
- `src/components/MentorChatPanel.tsx` — replaces AiPanel with mode selector tabs
- `prompts/mentor_system.md` — base mentor persona (PI + peer reviewer + senior postdoc)
- `prompts/writing_coach.md` — abstract, structure, reproducibility critique
- `prompts/cross_project_planner.md` — multi-project resource allocation prompt

### Files to Modify
- `src/app/page.tsx` — swap AiPanel for MentorChatPanel, add `chatMode` state

---

## Phase 5 — Cross-Project Planning + Progress Notifications

**Goal:** Resource allocation across projects, timely auto-notifications.

### Files to Create
- `src/app/api/research/cross_project_plan/route.ts` — multi-project Gantt + SMART plan
- `src/app/api/research/progress/route.ts` — file-change detection, notification generation
- `src/components/NotificationBell.tsx` — topbar badge + dropdown
- `src/components/ProjectMetaPanel.tsx` — full project configuration modal

### Files to Modify
- `src/app/page.tsx` — 30s progress polling, notification state, cross-project Gantt tab
- `src/components/Dashboard.tsx` — cross-project mode tab with color-coded Gantt

---

## Phase 6 — Polish

- `mentor_persona` setting in settings.json (domain customization)
- "Export Pipeline" → writes `ROADMAP.md` to project folder
- Keyboard shortcuts: `Cmd+P` pipeline, `Cmd+M` mentor chat
- App rebrand: "LabNotes" → "Research Mentor" in sidebar

---

## Storage Layout (per project folder)

```
DFT/
  .research_meta.json     ← Phase 1+: full project metadata (ProjectMeta)
  .ai_memory.md           ← existing: LLM context injection (updated on commit)
  .archive/               ← existing: old plans
  00_Research_Plan.md     ← existing: committed plan
  00_ToDo.md              ← existing: committed tasks
  *.md                    ← user notes
  *.pdf / *.docx          ← uploaded literature (indexed in Phase 2)
```

```
<project root>/
  settings.json           ← existing + mentor_persona, notification_polling_interval
  .dashboard_cache.json   ← existing + stage field per task
  .notifications.json     ← Phase 5: ProgressNotification[]
```

---

## Prompt Files

| File | Purpose |
|---|---|
| `prompts/AI_plan_research_project.md` | Existing base plan prompt |
| `prompts/mentor_system.md` | Phase 4: base PI mentor persona |
| `prompts/pipeline_planner.md` | Phase 3: milestone + SMART goal generation |
| `prompts/literature_analysis.md` | Phase 2: themes/gaps/citation analysis |
| `prompts/writing_coach.md` | Phase 4: manuscript critique |
| `prompts/cross_project_planner.md` | Phase 5: multi-project allocation |

---

## Context Budget (Gemma4:31b)

| Component | Token budget |
|---|---|
| System/persona prompt | ~1,000 |
| Project description + stage | ~500 |
| Milestones + SMART goals | ~2,000 |
| File summaries (Phase 2+) | ~8,000 (400/file × 20 files max) |
| Web search context | ~600 |
| **Total** | **~12,100** (well within 128K context) |

Per-file extracted text is truncated to 8,000 chars in fileIndex storage.
Use `temperature: 0.2` for all structured JSON output tasks (pipeline, dashboard, index).
Use default temperature for conversational mentor chat.
