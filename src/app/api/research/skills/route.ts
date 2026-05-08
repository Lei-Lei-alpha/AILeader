import { NextResponse } from 'next/server';
import { generatePPT, generateDoc, generateExcel, webSearch } from '@/lib/skyworkSkills';

export async function POST(request: Request) {
  try {
    const { name, params, projectFolder } = await request.json();

    if (!name || !params || !projectFolder) {
      return NextResponse.json({ error: 'name, params, and projectFolder are required' }, { status: 400 });
    }

    let result;
    switch (name) {
      case 'ppt':
        result = await generatePPT(params, projectFolder);
        break;
      case 'doc':
        result = await generateDoc(params, projectFolder);
        break;
      case 'excel':
        result = await generateExcel(params, projectFolder);
        break;
      case 'search':
        result = await webSearch(params.query);
        break;
      default:
        return NextResponse.json({ error: `Unknown skill: ${name}` }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error(`Local Skill Error (${name}):`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
