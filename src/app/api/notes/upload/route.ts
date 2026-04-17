import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const figuresDir = path.join(process.cwd(), 'public', 'figures');

// Ensure figures directory exists
async function ensureFiguresDir() {
  try {
    await fs.mkdir(figuresDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create figures directory:', error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureFiguresDir();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPG, GIF, WebP, SVG' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const originalName = file.name.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
    const filename = `${timestamp}-${randomStr}-${originalName}`;
    const filepath = path.join(figuresDir, filename);

    // Write file
    const buffer = await file.arrayBuffer();
    await fs.writeFile(filepath, Buffer.from(buffer));

    // Return markdown syntax and URL
    const markdownSyntax = `![${file.name}](/figures/${filename})`;
    
    return NextResponse.json({
      success: true,
      filename,
      url: `/figures/${filename}`,
      markdown: markdownSyntax
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// GET endpoint to list uploaded figures
export async function GET() {
  try {
    await ensureFiguresDir();

    const files = await fs.readdir(figuresDir);
    const figures = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
    }).map(filename => ({
      filename,
      url: `/figures/${filename}`
    }));

    return NextResponse.json({ figures });
  } catch (error) {
    console.error('List figures error:', error);
    return NextResponse.json(
      { error: 'Failed to list figures' },
      { status: 500 }
    );
  }
}
