import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { folderPath, filename, author, content } = await request.json();
    
    if (!folderPath || !filename) {
      return NextResponse.json({ error: 'Missing folderPath or filename' }, { status: 400 });
    }

    // Ensure the filename ends with .md
    let finalFilename = filename.trim();
    if (!finalFilename.endsWith('.md')) {
      finalFilename += '.md';
    }

    const fullPath = path.join(folderPath, finalFilename);

    // Check if the file already exists
    try {
      await fs.stat(fullPath);
      return NextResponse.json({ error: 'File already exists' }, { status: 409 });
    } catch (e) {
      // File does not exist, proceed
    }

    let fileContent = '';
    if (content) {
      fileContent = content;
    } else {
      // Generate template
      const displayTitle = finalFilename.replace('.md', '').split('-').join(' ').split('_').join(' ');
      const authorString = author ? `*Author: ${author}*\n` : '';
      fileContent = `# ${displayTitle}\n\n${authorString}*Created on: ${new Date().toLocaleDateString()}*\n\n---\n\nWrite your notes here...`;
    }

    // Write file
    await fs.writeFile(fullPath, fileContent);

    return NextResponse.json({ success: true, path: fullPath });
  } catch (error) {
    console.error('Failed to create note:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
