import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// @ts-ignore
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
// @ts-ignore
import WordExtractor from 'word-extractor';
import Tesseract from 'tesseract.js';

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
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    // 1. PDF Parsing
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      try {
        const data = await pdfParse(nodeBuffer);
        extractedText = data.text;
      } catch (err) {
        console.error('PDF Parse Error:', err);
        return NextResponse.json({ error: 'Failed to extract text from PDF.' }, { status: 500 });
      }
    } 
    // 2. DOCX Parsing (Modern MS Word)
    else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      try {
        const result = await mammoth.extractRawText({ buffer: nodeBuffer });
        extractedText = result.value;
      } catch (err) {
        console.error('DOCX Parse Error:', err);
        return NextResponse.json({ error: 'Failed to extract text from DOCX.' }, { status: 500 });
      }
    }
    // 3. DOC Parsing (Legacy MS Word)
    else if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
      try {
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(nodeBuffer);
        extractedText = extracted.getBody();
      } catch (err) {
        console.error('DOC Parse Error:', err);
        return NextResponse.json({ error: 'Failed to extract text from DOC.' }, { status: 500 });
      }
    }
    // 4. Image/Figure OCR (PNG, JPG, BMP)
    else if (fileType.startsWith('image/') || fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      const base64Data = nodeBuffer.toString('base64');
      
      // Save the figure as requested
      const figuresDir = path.join(process.cwd(), 'public', 'figures');
      try {
        await fs.mkdir(figuresDir, { recursive: true });
      } catch (e) {}
      
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const safeName = fileName.replace(/[^a-z0-9.-]/gi, '_');
      const savedFilename = `${timestamp}-${randomStr}-${safeName}`;
      const filepath = path.join(figuresDir, savedFilename);
      
      await fs.writeFile(filepath, nodeBuffer);

      return NextResponse.json({
        success: true,
        text: `![${file.name}](/figures/${savedFilename})\n[Image attached and passed directly to multimodal LLM]`,
        filename: file.name,
        imageBase64: base64Data
      });
    }
    // 5. Fallback for txt, md, csv, etc.
    else {
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
