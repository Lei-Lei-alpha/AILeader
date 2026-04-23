import { NextResponse } from 'next/server';
// @ts-ignore
import pdfParse from 'pdf-parse';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const nodeBuffer = Buffer.from(buffer);
    let extractedText = '';

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        const data = await pdfParse(nodeBuffer);
        extractedText = data.text;
      } catch (err) {
        console.error('PDF Parse Error:', err);
        return NextResponse.json({ error: 'Failed to extract text from PDF.' }, { status: 500 });
      }
    } else {
      // Fallback for txt, md, csv, etc.
      extractedText = nodeBuffer.toString('utf-8');
    }

    // Limit text to 30,000 characters to prevent overflow on context
    const TRUNCATION_LIMIT = 30000;
    if (extractedText.length > TRUNCATION_LIMIT) {
      extractedText = extractedText.substring(0, TRUNCATION_LIMIT) + '\n\n... [CONTENT TRUNCATED FOR LENGTH LIMIT]';
    }

    return NextResponse.json({
      success: true,
      text: extractedText,
      filename: file.name
    });

  } catch (error: any) {
    console.error('Document Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload document' },
      { status: 500 }
    );
  }
}
