// ── Research Pipeline ─────────────────────────────────────────────────────────

export type ResearchStage =
  | 'idea'
  | 'literature_review'
  | 'methodology'
  | 'experiments'
  | 'writing'
  | 'submission'
  | 'revision'
  | 'published';

export const RESEARCH_STAGES: ResearchStage[] = [
  'idea',
  'literature_review',
  'methodology',
  'experiments',
  'writing',
  'submission',
  'revision',
  'published',
];

export const STAGE_LABELS: Record<ResearchStage, string> = {
  idea: 'Idea',
  literature_review: 'Literature Review',
  methodology: 'Methodology',
  experiments: 'Experiments',
  writing: 'Writing',
  submission: 'Submission',
  revision: 'Revision',
  published: 'Published',
};

// ── Research Project ──────────────────────────────────────────────────────────

export interface ResearchProject {
  id: string;
  folderPath: string;
  displayName: string;
  stage: ResearchStage;
  description: string;
  startDate: string;           // ISO date YYYY-MM-DD
  targetSubmissionDate?: string;
  tags: string[];
  createdAt: number;           // unix ms
  updatedAt: number;
}

// ── Publication Target ────────────────────────────────────────────────────────

export type OutputType =
  | 'journal_paper'
  | 'conference_paper'
  | 'dataset'
  | 'grant'
  | 'thesis_chapter'
  | 'preprint';

export type PublicationStatus =
  | 'planning'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'published'
  | 'rejected';

export interface PublicationTarget {
  id: string;
  projectId: string;
  outputType: OutputType;
  title: string;
  targetVenue: string;
  impactFactor?: number;
  deadline?: string;           // ISO date
  status: PublicationStatus;
  notes: string;
}

// ── Research Milestone ────────────────────────────────────────────────────────

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface ResearchMilestone {
  id: string;
  projectId: string;
  stage: ResearchStage;
  title: string;
  description: string;
  dueDate: string;             // ISO date
  completedDate?: string;
  status: MilestoneStatus;
  dependsOn: string[];         // milestone ids
  linkedFiles: string[];       // absolute paths
}

// ── SMART Goal ────────────────────────────────────────────────────────────────

export interface SMARTGoal {
  id: string;
  projectId: string;
  milestoneId?: string;
  title: string;
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;           // ISO date
  assignedTo?: string;
  status: 'pending' | 'done';
  priority: 1 | 2 | 3 | 4 | 5;
  source_file?: string;        // backward compat with dashboard task toggle
}

// ── File Index ────────────────────────────────────────────────────────────────

export type IndexedFileType = 'md' | 'pdf' | 'docx' | 'image' | 'other';

export interface FileIndexEntry {
  filePath: string;
  relativePath: string;
  fileType: IndexedFileType;
  extractedText: string;       // truncated to 8000 chars
  summary?: string;            // LLM one-paragraph summary
  keywords: string[];
  lastIndexed: number;         // unix ms
  lastModified: number;        // from fs.stat mtimeMs
}

// ── Project Metadata (.research_meta.json) ────────────────────────────────────

export interface ProjectMeta {
  version: 2;
  project: ResearchProject;
  publicationTargets: PublicationTarget[];
  milestones: ResearchMilestone[];
  smartGoals: SMARTGoal[];
  fileIndex: FileIndexEntry[];
  lastProgressCheck: number;   // unix ms
}

// ── Progress Notification ─────────────────────────────────────────────────────

export type NotificationType =
  | 'milestone_due'
  | 'file_updated'
  | 'goal_completed'
  | 'stage_advance';

export interface ProgressNotification {
  id: string;
  projectId: string;
  message: string;
  type: NotificationType;
  createdAt: number;
  read: boolean;
}

// ── Dashboard Task (extends existing pattern) ─────────────────────────────────

export interface DashboardTask {
  id: string;
  source_folder: string;
  source_file: string;
  project: string;
  title: string;
  start: string;               // ISO date
  end: string;
  importance: number;          // 1–5
  urgency: number;             // 1–5
  status: 'pending' | 'done';
  stage?: ResearchStage;
  milestoneId?: string;
  smartGoalId?: string;
}

// ── Chat types (shared between page and components) ───────────────────────────

export type CalendarTask = {
  title: string;
  description: string;
  start: string;
  end: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  calendarTasks?: CalendarTask[];
};

export type MentorChatMode = 'mentor' | 'literature' | 'methodology' | 'writing';

// ── App Settings ─────────────────────────────────────────────────────────────

export type LLMProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini';

export interface AppSettings {
  folders: string[];
  author: string;
  deleteUnusedFigures: boolean;
  llm_provider: LLMProvider;
  ollama_url: string;
  ollama_model: string;
  openai_api_key?: string;
  openai_model?: string;
  anthropic_api_key?: string;
  anthropic_model?: string;
  gemini_api_key?: string;
  gemini_model?: string;
  mentor_persona?: string;
}

// ── Note (shared between page and sidebar) ────────────────────────────────────

export type Note = {
  name: string;
  path: string;
  folder: string;
  relativePath: string;
  size: number;
  lastModified: number;
  createdAt: number;
  snippet?: string;
};
