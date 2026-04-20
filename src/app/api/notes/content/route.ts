import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'settings.json');
const figuresDir = path.join(process.cwd(), 'public', 'figures');

async function getSettings(): Promise<any> {
  try {
    const data = await fs.readFile(settingsPath, 'utf8');
    let settings = JSON.parse(data);
    if (settings.deleteUnusedFigures === undefined) settings.deleteUnusedFigures = false;
    return settings;
  } catch (error) {
    return { deleteUnusedFigures: false };
  }
}

async function getFolders(): Promise<string[]> {
  try {
    const data = await fs.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(data);
    return settings.folders || [];
  } catch (error) {
    return [];
  }
}

// Extract figure URLs from markdown content
function extractFigureUrls(content: string): Set<string> {
  const figureUrls = new Set<string>();
  // Match markdown image syntax: ![alt text](/figures/filename.ext)
  const regex = /!\[.*?\]\(\/figures\/([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    figureUrls.add(match[1]); // Add just the filename
  }
  return figureUrls;
}

// Recursively scan folder for all markdown files and extract figure URLs
async function scanFolderForFigures(folderPath: string, figuresInUse: Set<string>): Promise<void> {
  try {
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(folderPath, item.name);
      if (item.isDirectory() && !item.name.startsWith('.')) {
        await scanFolderForFigures(fullPath, figuresInUse);
      } else if (item.isFile() && item.name.endsWith('.md')) {
        try {
          const fileContent = await fs.readFile(fullPath, 'utf8');
          const figures = extractFigureUrls(fileContent);
          figures.forEach(fig => figuresInUse.add(fig));
        } catch (err) {
          console.error(`Error reading file ${fullPath}:`, err);
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning folder ${folderPath}:`, err);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFilePath = searchParams.get('path');

    if (!rawFilePath) {
      return NextResponse.json({ error: 'Missing file path parameter' }, { status: 400 });
    }
    const filePath = path.normalize(rawFilePath);

    // Security check: ensure the file path starts with one of the configured folders
    const folders = await getFolders();
    const isAllowed = folders.some(folder => filePath.startsWith(path.normalize(folder)));
    
    if (!isAllowed) {
      return NextResponse.json({ error: 'Access denied: Path not in configured folders' }, { status: 403 });
    }
    
    // Ensure the file is actually a markdown file
    if (!filePath.endsWith('.md')) {
      return NextResponse.json({ error: 'Only .md files can be read' }, { status: 400 });
    }
    
    // Check if file exists and get content
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return NextResponse.json({ content });
    } catch (e) {
      return NextResponse.json({ error: 'File not found or unreadable' }, { status: 404 });
    }
    
  } catch (error) {
    console.error('Content API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { path: rawFilePath, content, previousContent } = await request.json();
    if (!rawFilePath || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing file path or content' }, { status: 400 });
    }
    const filePath = path.normalize(rawFilePath);

    const folders = await getFolders();
    const isAllowed = folders.some(folder => filePath.startsWith(path.normalize(folder)));
    if (!isAllowed) {
      return NextResponse.json({ error: 'Access denied: Path not in configured folders' }, { status: 403 });
    }

    if (!filePath.endsWith('.md')) {
      return NextResponse.json({ error: 'Only .md files can be written' }, { status: 400 });
    }

    try {
      await fs.stat(filePath);
    } catch (e) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Save the content first
    await fs.writeFile(filePath, content, 'utf8');

    // Handle figure cleanup if enabled
    const settings = await getSettings();
    if (settings.deleteUnusedFigures && previousContent) {
      try {
        const oldFigures = extractFigureUrls(previousContent);
        const newFigures = extractFigureUrls(content);
        
        // Find figures that are no longer referenced
        const unusedFigures = Array.from(oldFigures).filter(fig => !newFigures.has(fig));

        if (unusedFigures.length > 0) {
          // Check if figures are used in other files before deleting
          let figuresInUse: Set<string> = new Set();
          
          try {
            // Scan all markdown files in configured folders
            for (const folder of folders) {
              await scanFolderForFigures(folder, figuresInUse);
            }
          } catch (err) {
            console.error('Error scanning folders for figure usage:', err);
          }

          // Delete unused figures that aren't referenced elsewhere
          for (const figure of unusedFigures) {
            if (!figuresInUse.has(figure)) {
              try {
                const figurePath = path.join(figuresDir, figure);
                await fs.unlink(figurePath);
                console.log(`Deleted unused figure: ${figure}`);
              } catch (err) {
                console.error(`Failed to delete figure ${figure}:`, err);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error during figure cleanup:', err);
        // Don't fail the save if cleanup fails
      }
    }

    return NextResponse.json({ success: true, content });
  } catch (error) {
    console.error('Content save error:', error);
    return NextResponse.json({ error: 'Failed to save content' }, { status: 500 });
  }
}
