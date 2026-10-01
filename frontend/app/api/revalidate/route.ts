import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = request.headers.get('x-revalidation-secret');
  if (!process.env.REVALIDATION_SECRET || secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const tags = Array.isArray(body?.tags) ? body.tags.filter((tag: unknown) => typeof tag === 'string') : [];

  for (const tag of tags) revalidateTag(tag, 'max');

  const paths = Array.isArray(body?.paths) ? body.paths.filter((path: unknown) => typeof path === 'string' && path.startsWith('/')) : [];
  for (const path of paths) revalidatePath(path);

  return NextResponse.json({ ok: true, tags, paths });
}
