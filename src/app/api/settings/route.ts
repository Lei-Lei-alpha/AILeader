import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';

export async function GET() {
  try {
    return NextResponse.json(await getSettings());
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const updates = await request.json();
    const settings = await getSettings();

    if (updates.author !== undefined)               settings.author = String(updates.author).trim() || 'Lab User';
    if (updates.deleteUnusedFigures !== undefined)  settings.deleteUnusedFigures = Boolean(updates.deleteUnusedFigures);
    if (updates.llm_provider !== undefined)         settings.llm_provider = updates.llm_provider;
    if (updates.ollama_url !== undefined)           settings.ollama_url = String(updates.ollama_url).trim();
    if (updates.ollama_model !== undefined)         settings.ollama_model = String(updates.ollama_model).trim();
    if (updates.openai_api_key !== undefined)       settings.openai_api_key = String(updates.openai_api_key).trim();
    if (updates.openai_model !== undefined)         settings.openai_model = String(updates.openai_model).trim();
    if (updates.anthropic_api_key !== undefined)    settings.anthropic_api_key = String(updates.anthropic_api_key).trim();
    if (updates.anthropic_model !== undefined)      settings.anthropic_model = String(updates.anthropic_model).trim();
    if (updates.gemini_api_key !== undefined)        settings.gemini_api_key = String(updates.gemini_api_key).trim();
    if (updates.gemini_model !== undefined)          settings.gemini_model = String(updates.gemini_model).trim();
    if (updates.skywork_api_key !== undefined)      settings.skywork_api_key = String(updates.skywork_api_key).trim();
    if (updates.skywork_gateway_url !== undefined)  settings.skywork_gateway_url = String(updates.skywork_gateway_url).trim();
    if (updates.mentor_persona !== undefined)       settings.mentor_persona = String(updates.mentor_persona).trim();

    await saveSettings(settings);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
