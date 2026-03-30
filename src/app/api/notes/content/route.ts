import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'settings.json');

async function getFolders(): Promise<string[]> {
  try {
    const data = await fs.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(data);
    return settings.folders || [];
  } catch (error) {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    
    if (!filePath) {
      return NextResponse.json({ error: 'Missing file path parameter' }, { status: 400 });
    }
    
    // Security check: ensure the file path starts with one of the configured folders
    const folders = await getFolders();
    const isAllowed = folders.some(folder => filePath.startsWith(folder));
    
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
