import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'settings.json');

// Simplified folder retrieval (auto-discovery already runs on /api/notes so settings is typically fresh)
async function getFolders(): Promise<string[]> {
  try {
    const data = await fs.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(data);
    return settings.folders || [];
  } catch (error) {
    return [];
  }
}

async function searchInDirectory(dir: string, baseDir: string, query: string): Promise<any[]> {
  let results: any[] = [];
  try {
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const item of list) {
      if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '.next') continue;
      
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        const subFiles = await searchInDirectory(fullPath, baseDir, query);
        results = results.concat(subFiles);
      } else if (item.name.endsWith('.md')) {
        const content = await fs.readFile(fullPath, 'utf8');
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        
        const index = lowerContent.indexOf(lowerQuery);
        
        // If content matches or title matches
        if (index !== -1 || item.name.toLowerCase().includes(lowerQuery)) {
          const stats = await fs.stat(fullPath);
          
          // Generate a snippet roughly 40 chars before and 60 after
          let snippet = '';
          if (index !== -1) {
            const start = Math.max(0, index - 40);
            const end = Math.min(content.length, index + query.length + 60);
            snippet = content.substring(start, end).replace(/\n/g, ' ').trim();
            if (start > 0) snippet = '...' + snippet;
            if (end < content.length) snippet = snippet + '...';
          }
          
          results.push({
            name: item.name,
            path: fullPath,
            folder: baseDir,
            relativePath: path.relative(baseDir, fullPath),
            size: stats.size,
            lastModified: stats.mtimeMs,
            createdAt: stats.birthtimeMs,
            snippet
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error searching ${dir}:`, err);
  }
  return results;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] });
    }
    
    const folders = await getFolders();
    let allSearchResults: any[] = [];
    
    for (const folder of folders) {
      const folderResults = await searchInDirectory(folder, folder, query.trim());
      allSearchResults = allSearchResults.concat(folderResults);
    }
    
    // Sort by last modified
    allSearchResults.sort((a, b) => b.lastModified - a.lastModified);
    
    return NextResponse.json({ results: allSearchResults });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Failed to execute search' }, { status: 500 });
  }
}
