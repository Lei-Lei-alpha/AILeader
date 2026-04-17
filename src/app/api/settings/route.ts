import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'settings.json');

async function getSettings(): Promise<any> {
  try {
    const data = await fs.readFile(settingsPath, 'utf8');
    let settings = JSON.parse(data);
    if (!settings.author) settings.author = "Lab User";
    if (settings.deleteUnusedFigures === undefined) settings.deleteUnusedFigures = false;
    return settings;
  } catch (error) {
    const defaultSettings = { 
      folders: [], 
      author: "Lab User",
      deleteUnusedFigures: false
    };
    await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
    return defaultSettings;
  }
}

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const updates = await request.json();
    const settings = await getSettings();

    // Only allow updating specific fields
    if (updates.author !== undefined) {
      settings.author = String(updates.author).trim() || "Lab User";
    }
    if (updates.deleteUnusedFigures !== undefined) {
      settings.deleteUnusedFigures = Boolean(updates.deleteUnusedFigures);
    }

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
