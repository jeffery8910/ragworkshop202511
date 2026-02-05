import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // legacy payload shape (usage-detailed.html): { question: "..." }
    const query = (body?.query ?? body?.question ?? '').toString().trim();
    if (!query) return NextResponse.json({ error: 'query/question is required' }, { status: 400 });

    const topK =
      toNumber(body?.topK) ??
      toNumber(body?.top_k) ??
      toNumber(body?.TOP_K) ??
      toNumber(body?.TOPK);

    const includeAnswerRaw = body?.includeAnswer ?? body?.include_answer ?? body?.answer ?? undefined;
    const includeAnswer =
      typeof includeAnswerRaw === 'boolean'
        ? includeAnswerRaw
        : includeAnswerRaw === 'false'
          ? false
          : includeAnswerRaw === 'true'
            ? true
            : true;

    const rewriteRaw = body?.rewrite ?? body?.queryRewrite ?? undefined;
    const rewrite =
      typeof rewriteRaw === 'boolean'
        ? rewriteRaw
        : rewriteRaw === 'true'
          ? true
          : false;

    const forwardBody: any = {
      query,
      includeAnswer,
      rewrite,
    };
    if (topK !== undefined) forwardBody.topK = topK;
    if (body?.useGraph !== undefined) forwardBody.useGraph = body.useGraph;
    if (body?.agenticLevel !== undefined) forwardBody.agenticLevel = body.agenticLevel;

    const url = new URL('/api/workshop/retrieve', req.url);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(forwardBody),
      cache: 'no-store',
    });

    const contentType = res.headers.get('content-type') || 'application/json';
    const text = await res.text().catch(() => '');
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } });
  } catch (error: any) {
    console.error('API test route error', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    hint: 'POST { "question": "..." } or { "query": "..." }',
  });
}

