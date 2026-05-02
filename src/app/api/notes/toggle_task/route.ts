import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export async function POST(request: Request) {
  try {
    const { source_folder, source_file, title, new_status, smartGoalId, milestoneId } = await request.json();

    if (!source_folder || !source_file || !title) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const filePath = path.join(source_folder, source_file);
    
    let content = '';
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch (e) {
      return NextResponse.json({ error: 'Failed to access source file' }, { status: 404 });
    }

    if (source_file === '.research_meta.json') {
      try {
        const meta = JSON.parse(content);
        let updated = false;

        if (smartGoalId && meta.smartGoals) {
          const goal = meta.smartGoals.find((g: any) => g.id === smartGoalId);
          if (goal) {
            goal.status = new_status === 'done' ? 'done' : 'pending';
            updated = true;
          }
        }

        if (milestoneId && meta.milestones) {
          const milestone = meta.milestones.find((m: any) => m.id === milestoneId);
          if (milestone) {
            milestone.status = new_status === 'done' ? 'completed' : 'pending';
            updated = true;
          }
        }

        if (updated) {
          await fs.writeFile(filePath, JSON.stringify(meta, null, 2), 'utf8');
        } else {
          return NextResponse.json({ error: 'Could not find goal or milestone in meta file' }, { status: 404 });
        }
      } catch (e) {
        return NextResponse.json({ error: 'Failed to parse meta file' }, { status: 500 });
      }
    } else {
      const escapedTitle = escapeRegExp(title.replace(/^\[(Goal|Milestone)\]\s+/, '').trim());
      
      // Create a regex to match `- [ ] title` or `- [x] title` (ignoring loose spaces)
      const lineRegex = new RegExp(`^(\\s*-\\s*\\[)([\\sXx])(\\]\\s+.*${escapedTitle}.*)$`, 'm');

      const match = content.match(lineRegex);

      if (!match) {
          // Fallback: If AI compressed the title slightly, we try a more relaxed search
          const looseRegex = new RegExp(`^(\\s*-\\s*\\[)([\\sXx])(\\]\\s+.*${escapedTitle.split(/\s+/)[0]}.*)$`, 'mi');
          const matchLoose = content.match(looseRegex);
          if(!matchLoose) {
              return NextResponse.json({ error: 'Could not confidently locate task in markdown file.' }, { status: 404 });
          } else {
              const checkChar = new_status === 'done' ? 'x' : ' ';
              content = content.replace(looseRegex, `$1${checkChar}$3`);
          }
      } else {
          const checkChar = new_status === 'done' ? 'x' : ' ';
          content = content.replace(lineRegex, `$1${checkChar}$3`);
      }

      await fs.writeFile(filePath, content, 'utf8');
    }

    // Update global cache so the UI stays synced on reload
    const cachePath = path.join(process.cwd(), '.dashboard_cache.json');
    try {
      const cacheData = await fs.readFile(cachePath, 'utf8');
      const cache = JSON.parse(cacheData);
      let cacheUpdated = false;
      for (const t of cache.tasks) {
        if (t.source_folder === source_folder && t.source_file === source_file && t.title === title) {
          t.status = new_status;
          cacheUpdated = true;
          break;
        }
      }
      if (cacheUpdated) {
        await fs.writeFile(cachePath, JSON.stringify(cache), 'utf8');
      }
    } catch (e) {
      // cache missing or corrupted, ignore syncing
    }

    return NextResponse.json({ success: true, message: `Updated task in ${source_file}` });

  } catch (error: any) {
    console.error('Task Toggle API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
