import fs from 'fs/promises';
import path from 'path';
import PptxGenJS from 'pptxgenjs';
import * as docx from 'docx';
import ExcelJS from 'exceljs';

export interface SkyworkSkillResponse {
  success: boolean;
  message: string;
  localPath?: string;
  data?: any;
}

/**
 * Local PowerPoint Generation using pptxgenjs
 */
export async function generatePPT(
  params: { slides: any[] },
  projectFolder: string
): Promise<SkyworkSkillResponse> {
  const pres = new PptxGenJS();
  
  if (!params.slides || !Array.isArray(params.slides)) {
    throw new Error('Invalid PPT params: "slides" array is required.');
  }

  for (const slideData of params.slides) {
    const slide = pres.addSlide();
    
    if (slideData.title) {
      slide.addText(slideData.title, {
        x: 0.5, y: 0.5, w: '90%', h: 1,
        fontSize: 24, bold: true, color: '363636',
        align: pres.AlignH.center
      });
    }

    if (slideData.content && Array.isArray(slideData.content)) {
      slide.addText(slideData.content.map((text: string) => ({ text, options: { bullet: true } })), {
        x: 0.5, y: 1.5, w: '90%', h: 3,
        fontSize: 18, color: '595959',
        valign: pres.AlignV.top
      });
    } else if (typeof slideData.content === 'string') {
        slide.addText(slideData.content, {
            x: 0.5, y: 1.5, w: '90%', h: 3,
            fontSize: 18, color: '595959',
            valign: pres.AlignV.top
        });
    }
  }

  const filename = `Presentation_${Date.now()}.pptx`;
  const localPath = path.join(projectFolder, filename);

  // Write to buffer then to file
  const buffer = await pres.write('nodebuffer') as Buffer;
  await fs.writeFile(localPath, buffer);

  return {
    success: true,
    message: `Presentation generated locally: ${filename}`,
    localPath
  };
}

/**
 * Local Document Generation using docx
 */
export async function generateDoc(
  params: { title: string; sections: any[] },
  projectFolder: string
): Promise<SkyworkSkillResponse> {
  const doc = new docx.Document({
    sections: [{
      properties: {},
      children: [
        new docx.Paragraph({
          text: params.title,
          heading: docx.HeadingLevel.TITLE,
        }),
        ...params.sections.flatMap(section => [
          new docx.Paragraph({
            text: section.heading,
            heading: docx.HeadingLevel.HEADING_1,
            spacing: { before: 400 },
          }),
          new docx.Paragraph({
            text: section.content,
            spacing: { after: 200 },
          })
        ])
      ],
    }],
  });

  const buffer = await docx.Packer.toBuffer(doc);
  const filename = `Document_${Date.now()}.docx`;
  const localPath = path.join(projectFolder, filename);

  await fs.writeFile(localPath, buffer);

  return {
    success: true,
    message: `Document generated locally: ${filename}`,
    localPath
  };
}

/**
 * Local Excel Generation using exceljs
 */
export async function generateExcel(
  params: { title: string; sheets: any[] },
  projectFolder: string
): Promise<SkyworkSkillResponse> {
  const workbook = new ExcelJS.Workbook();
  
  for (const sheetData of params.sheets) {
    const sheet = workbook.addWorksheet(sheetData.name || 'Sheet');
    if (sheetData.columns) {
      sheet.columns = sheetData.columns.map((c: any) => ({ header: c.header, key: c.key, width: c.width || 15 }));
    }
    if (sheetData.rows) {
      sheet.addRows(sheetData.rows);
    }
  }

  const filename = `Data_${Date.now()}.xlsx`;
  const localPath = path.join(projectFolder, filename);
  await workbook.xlsx.writeFile(localPath);

  return {
    success: true,
    message: `Excel workbook generated locally: ${filename}`,
    localPath
  };
}

/**
 * Web Search - Keep this as is for now, as it's a retrieval skill.
 * If user wants it purely local, they might mean using a search tool we have.
 */
export async function webSearch(query: string): Promise<SkyworkSkillResponse> {
    const { search } = await import('duck-duck-scrape');
    const results = await search(query, { safeSearch: 1 as any });
    const top = results.results.slice(0, 5).map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.description
    }));

    return {
        success: true,
        message: `Found ${top.length} results for "${query}"`,
        data: top
    };
}
