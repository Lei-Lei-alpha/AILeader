import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { generateText } from '@/lib/universalLLM';

export async function POST(request: Request) {
  try {
    const { filePath, customPrompt } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
    }

    // Read the note content
    const content = await fs.readFile(filePath, 'utf8');

    const prompt = customPrompt || `Please provide a concise summary of the following note. Focus on key findings, decisions, and action items:\n\n${content}`;

    const summary = await generateText(prompt);

    return NextResponse.json({ summary });

  } catch (error: any) {
    console.error('Summarization API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
