import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSettings, saveSettings } from '@/lib/settings';


export async function GET() {
  try {
    const settings = await getSettings();
    const originalCount = settings.folders.length;
    
    // Verify each folder exists
    const existingFolders: string[] = [];
    for (const folder of settings.folders) {
      try {
        const stats = await fs.stat(folder);
        if (stats.isDirectory()) {
          existingFolders.push(folder);
        }
      } catch (e) {
        // Folder does not exist, skip it
      }
    }

    // If any folders were removed, update settings
    if (existingFolders.length !== originalCount) {
      settings.folders = existingFolders;
      await saveSettings(settings);
    }

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
      await saveSettings(settings);
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

    settings.folders = settings.folders.filter((f) => f !== folderPath);
    await saveSettings(settings);

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
