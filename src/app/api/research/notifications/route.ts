import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';
import { getSystemWideNotifications } from '@/lib/notifications';

export async function GET() {
  try {
    const settings = await getSettings();
    const folders = settings.folders || [];
    const notifications = await getSystemWideNotifications(folders);
    return NextResponse.json({ notifications });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
