import fs from 'fs/promises';
import path from 'path';

export const SETTINGS_PATH = path.join(process.cwd(), 'settings.json');
export const DASHBOARD_CACHE_PATH = path.join(process.cwd(), '.dashboard_cache.json');
export const NOTIFICATIONS_PATH = path.join(process.cwd(), '.notifications.json');

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

const DEFAULT_SETTINGS: AppSettings = {
  folders: [],
  author: 'Lab User',
  deleteUnusedFigures: false,
  llm_provider: 'ollama',
  ollama_url: 'http://localhost:11434',
  ollama_model: 'llama3',
  openai_model: 'gpt-4o',
  anthropic_model: 'claude-3-5-sonnet-20240620',
  gemini_model: 'gemini-1.5-pro',
  skywork_gateway_url: 'https://office.skywork.ai/api/v1',
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const data = await fs.readFile(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(data);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const merged = { ...current, ...updates };
  await saveSettings(merged);
  return merged;
}

export async function getFolders(): Promise<string[]> {
  const settings = await getSettings();
  return settings.folders ?? [];
}
