import { NextResponse } from 'next/server';
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
      try {
        const { data: { text } } = await Tesseract.recognize(nodeBuffer, 'eng');
        extractedText = "--- BEGIN OCR GRAPHICAL EXTRACTION ---\n" + text + "\n--- END OCR GRAPHICAL EXTRACTION ---\n\n[WARNING: Currently unable to natively read graphical figure data. Only textual data has been extracted via OCR.]";
      } catch (err) {
        console.error('Image OCR Error:', err);
        return NextResponse.json({ error: 'Failed to extract optical text from Image.' }, { status: 500 });
      }
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
