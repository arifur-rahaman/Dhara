import { NextResponse } from 'next/server';
import { can } from '@/server/authz';
import { getCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { draftProvider } from '@/server/providers/ai-draft';
import { checklist, outline } from '@/features/drafting/kinds';
import { stripCitations } from '@/features/drafting/redact';
import { draftInput, namesToHide, redactInput, sealMap } from '@/features/drafting/server';

export const dynamic = 'force-dynamic';
// Drafts can take a minute or two; hosts that honour this give the function time to finish.
export const maxDuration = 300;

/**
 * Writes a draft (F33) and streams it as it is written, one JSON object per line:
 *   {"t":"map","map":{...}}       placeholders → the lawyer's own values, so the screen can show names
 *   {"t":"delta","text":"..."}    text as it is written (with placeholders)
 *   {"t":"done","id","text","removed"}  the saved draft, after law-report citations were removed
 *   {"t":"error","error":"..."}
 * Only placeholders reach the AI provider and the database (plan.md 7.5).
 */
export async function POST(request: Request) {
  const ctx = await getCtx();
  if (!ctx || !can.useAi(ctx)) return new NextResponse('Not found', { status: 404 });
  const parsed = draftInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const input = parsed.data;
  const names = await namesToHide(ctx, input);
  if (!names) return new NextResponse('Not found', { status: 404 });
  const { facts, map } = redactInput(input, names);

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      send({ t: 'map', map });
      try {
        const stream = draftProvider().streamDraft({
          kind: input.kind,
          language: input.language,
          facts,
          checklist: checklist[input.kind],
          outline: outline[input.kind][input.language],
        });
        let step = await stream.next();
        while (!step.done) {
          send({ t: 'delta', text: step.value });
          step = await stream.next();
        }
        if (step.value.refused || !step.value.text.trim()) {
          send({ t: 'error', error: 'unavailable' });
          return;
        }
        const guarded = stripCitations(step.value.text);
        const saved = await withTenant(scopeOf(ctx), (tx) =>
          tx.aiDraft.create({
            data: {
              chamberId: ctx.chamberId,
              caseId: input.caseId,
              kind: input.kind,
              language: input.language,
              redactedInput: facts,
              output: guarded.text,
              removedCitations: guarded.removed,
              redactionMapEnc: sealMap(map),
              createdBy: ctx.userId,
            },
            select: { id: true },
          }),
        );
        send({ t: 'done', id: saved.id, text: guarded.text, removed: guarded.removed });
      } catch {
        console.error('[ai] draft failed');
        send({ t: 'error', error: 'unavailable' });
      } finally {
        controller.close();
      }
    },
  });
  return new NextResponse(body, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
