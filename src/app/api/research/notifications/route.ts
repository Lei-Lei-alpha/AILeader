import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSettings } from '@/lib/settings';
import { getSystemWideNotifications } from '@/lib/notifications';

const READ_IDS_PATH = path.join(process.cwd(), '.notifications_read.json');

async function getReadIds(): Promise<Set<string>> {
  try {
    const data = await fs.readFile(READ_IDS_PATH, 'utf8');
    return new Set(JSON.parse(data));
  } catch {
    return new Set();
  }
}

async function saveReadIds(ids: Set<string>): Promise<void> {
  // Keep only recent 500 IDs to avoid unbounded growth
  const arr = Array.from(ids).slice(-500);
  await fs.writeFile(READ_IDS_PATH, JSON.stringify(arr));
}

export async function GET() {
  try {
    const settings = await getSettings();
    const folders = settings.folders || [];
    const [notifications, readIds] = await Promise.all([
      getSystemWideNotifications(folders),
      getReadIds(),
    ]);
    const withRead = notifications.map((n) => ({ ...n, read: readIds.has(n.id) }));
    return NextResponse.json({ notifications: withRead });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { readIds: newReadIds }: { readIds: string[] } = await request.json();
    if (!Array.isArray(newReadIds)) {
      return NextResponse.json({ error: 'readIds must be an array' }, { status: 400 });
    }
    const existing = await getReadIds();
    for (const id of newReadIds) existing.add(id);
    await saveReadIds(existing);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
