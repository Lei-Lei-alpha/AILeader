import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'settings.json');

async function getSettings() {
  try {
    const data = await fs.readFile(settingsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const defaultSettings = { folders: [] };
      await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }
    throw error;
  }
}

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { folderPath: rawFolderPath } = await request.json();
    if (!rawFolderPath || typeof rawFolderPath !== 'string') {
      return NextResponse.json({ error: 'Invalid folder path' }, { status: 400 });
    }
    const folderPath = path.normalize(rawFolderPath);

    const settings = await getSettings();

    // Validate folder exists
    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
         return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'Directory does not exist' }, { status: 400 });
    }

    if (!settings.folders.includes(folderPath)) {
      settings.folders.push(folderPath);
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    }
    
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { folderPath } = await request.json();
    const settings = await getSettings();
    
    settings.folders = settings.folders.filter((f: string) => f !== folderPath);
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
