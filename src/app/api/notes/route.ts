import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'settings.json');
const defaultRootPath = process.cwd(); // The root workspace

async function autoDiscoverFolders(existingFolders: string[]): Promise<string[]> {
  try {
    const list = await fs.readdir(defaultRootPath, { withFileTypes: true });
    const discovered: string[] = [];
    
    for (const item of list) {
      if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules' && item.name !== 'src' && item.name !== 'public') {
        const fullPath = path.join(defaultRootPath, item.name);
        if (!existingFolders.includes(fullPath)) {
           // Let's do a quick check if it contains any .md files right inside or deeply. For simplicity, just add the directory if it's not a known ignored folder.
           discovered.push(fullPath);
        }
      }
    }
    
    if (discovered.length > 0) {
      const merged = [...existingFolders, ...discovered];
      await fs.writeFile(settingsPath, JSON.stringify({ folders: merged }, null, 2));
      return merged;
    }
  } catch (err) {
    console.error('Auto-discover failed:', err);
  }
  return existingFolders;
}

async function getSettings(): Promise<any> {
  try {
    const data = await fs.readFile(settingsPath, 'utf8');
    let settings = JSON.parse(data);
    settings.folders = await autoDiscoverFolders(settings.folders || []);
    if (!settings.author) settings.author = "Lab User"; // Provide default if missing
    return settings;
  } catch (error) {
    const defaultSettings = { folders: await autoDiscoverFolders([]), author: "Lab User" };
    await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
    return defaultSettings;
  }
}

async function getMarkdownFiles(dir: string, baseDir: string): Promise<any[]> {
  let results: any[] = [];
  try {
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const item of list) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        const subFiles = await getMarkdownFiles(fullPath, baseDir);
        results = results.concat(subFiles);
      } else if (item.name.endsWith('.md')) {
        const stats = await fs.stat(fullPath);
        results.push({
          name: item.name,
          path: fullPath,
          folder: baseDir,
          relativePath: path.relative(baseDir, fullPath),
          size: stats.size,
          lastModified: stats.mtimeMs,
          createdAt: stats.birthtimeMs,
        });
      }
    }
  } catch (err) {
    console.error(`Error reading ${dir}:`, err);
  }
  return results;
}

export async function GET() {
  try {
    const settings = await getSettings();
    const folders = settings.folders;
    let allNotes: any[] = [];
    
    for (const folder of folders) {
      const notesInFolder = await getMarkdownFiles(folder, folder);
      allNotes = allNotes.concat(notesInFolder);
    }
    
    // Sort by last modified descending
    allNotes.sort((a, b) => b.lastModified - a.lastModified);
    
    return NextResponse.json({ notes: allNotes, author: settings.author });
  } catch (error) {
    console.error('Notes API error:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}
