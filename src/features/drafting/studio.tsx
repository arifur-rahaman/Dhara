'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Field, PrimaryButton, SecondaryButton, inputClass } from '@/components/form';
import { Icon } from '@/components/icons';
import { checkDraft, type CheckResult } from './actions';
import { draftKinds, type DraftKind } from './kinds';
import { restore, type RedactionMap } from './redact';
import { DraftPaper } from './paper';

type CaseOption = { id: string; label: string };
const field = `${inputClass} h-12 text-[16px] px-3.5`;

/**
 * AI draft (AIDraft design, F33): kind, facts, the checklist of what the draft needs, then the draft as it
 * is written. Names in the case and any the lawyer lists are hidden before anything is sent.
 */
export function DraftStudio({ cases, caseNames }: { cases: CaseOption[]; caseNames: Record<string, string[]> }) {
  const t = useTranslations('drafts');
  // The next-intl locale is the full Intl tag (for example bn-BD-u-nu-beng); the language is its start.
  const locale: 'en' | 'bn' = useLocale().startsWith('bn') ? 'bn' : 'en';
  const router = useRouter();
  const [kind, setKind] = useState<DraftKind>('plaint');
  const [caseId, setCaseId] = useState('');
  const [facts, setFacts] = useState('');
  const [names, setNames] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<Extract<CheckResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ text: string; map: RedactionMap; id?: string; removed?: number } | null>(null);
  const [writing, setWriting] = useState(false);
  const [pending, startTransition] = useTransition();

  const nameList = () =>
    names
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter(Boolean);
  const fullFacts = () => {
    const extra = check?.items
      .filter((i) => !i.found && answers[i.key]?.trim())
      .map((i) => `${i.question}\n${answers[i.key].trim()}`);
    return extra?.length ? `${facts.trim()}\n\n${extra.join('\n\n')}` : facts.trim();
  };
  const payload = () => ({ kind, language: locale, facts: fullFacts(), names: nameList(), caseId: caseId || null });

  const onCheck = () => {
    setError(null);
    setDraft(null);
    if (facts.trim().length < 20) return setError('tooShort');
    startTransition(async () => {
      const result = await checkDraft(payload());
      if (!result.ok) return setError(result.error);
      setCheck(result);
    });
  };

  const onWrite = async () => {
    setError(null);
    setWriting(true);
    setDraft({ text: '', map: {} });
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      if (!res.ok || !res.body) throw new Error('failed');
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      let map: RedactionMap = {};
      let text = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines.filter(Boolean)) {
          const msg = JSON.parse(line) as
            | { t: 'map'; map: RedactionMap }
            | { t: 'delta'; text: string }
            | { t: 'done'; id: string; text: string; removed: number }
            | { t: 'error'; error: string };
          if (msg.t === 'map') map = msg.map;
          else if (msg.t === 'delta') {
            text += msg.text;
            setDraft({ text, map });
          } else if (msg.t === 'done') {
            setDraft({ text: msg.text, map, id: msg.id, removed: msg.removed });
            router.refresh();
          } else setError(msg.error);
        }
      }
    } catch {
      setError('unavailable');
    } finally {
      setWriting(false);
    }
  };

  const missing = check?.items.filter((i) => !i.found).length ?? 0;

  return (
    <div className="flex flex-col gap-3.5">
      <div role="group" aria-label={t('kind')} className="flex flex-wrap gap-2">
        {draftKinds.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setCheck(null);
              setDraft(null);
            }}
            className="h-10 rounded-full border border-border px-4 text-[14px] font-semibold aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
          >
            {t(`kinds.${k}`)}
          </button>
        ))}
      </div>

      <Field id="draft-case" label={t('case')}>
        <select
          id="draft-case"
          value={caseId}
          onChange={(e) => {
            setCaseId(e.target.value);
            setNames((caseNames[e.target.value] ?? []).join(', '));
            setCheck(null);
          }}
          className={field}
        >
          <option value="">{t('noCase')}</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field id="draft-facts" label={t('facts')}>
        <textarea
          id="draft-facts"
          rows={6}
          maxLength={12000}
          value={facts}
          onChange={(e) => {
            setFacts(e.target.value);
            setCheck(null);
          }}
          placeholder={t('factsPlaceholder')}
          className={`${inputClass} h-auto py-3 text-[15px]`}
        />
      </Field>

      <Field id="draft-names" label={t('names')} hint={<p className="text-[13px] text-muted">{t('namesHint')}</p>}>
        <input id="draft-names" value={names} onChange={(e) => setNames(e.target.value)} className={field} />
      </Field>

      <p className="flex items-start gap-2 text-[13px] text-muted">
        <Icon name="shield" size={18} className="mt-0.5 shrink-0" />
        <span>{t('redactNote')}</span>
      </p>

      <SecondaryButton type="button" onClick={onCheck} pending={pending}>
        {t('checkButton')}
      </SecondaryButton>

      {error && (
        <p role="alert" className="rounded-[12px] bg-lock-bg px-3.5 py-2.5 text-[14px] text-lock-text">
          {t(`errors.${error}`)}
        </p>
      )}

      {check && (
        <section
          aria-labelledby="draft-checks"
          className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
        >
          <div className="flex items-center justify-between">
            <h2 id="draft-checks" className="text-[16px] font-semibold">
              {t('checksTitle')}
            </h2>
            <span className="text-[13px] font-semibold">
              {t('checksCount', { found: check.items.length - missing, total: check.items.length })}
            </span>
          </div>
          <ul className="flex flex-col">
            {check.items.map((i) => (
              <li key={i.key} className="flex flex-col gap-1.5 border-t border-border py-2 first:border-t-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px]">{t(`checks.${i.key}`)}</span>
                  <span className={`text-[13px] font-semibold ${i.found ? 'text-ok' : 'text-lock-text'}`}>
                    {i.found ? t('found') : t('missing')}
                  </span>
                </div>
                {!i.found && (
                  <>
                    <label htmlFor={`answer-${i.key}`} className="text-[13px] text-muted">
                      {i.question}
                    </label>
                    <input
                      id={`answer-${i.key}`}
                      value={answers[i.key] ?? ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [i.key]: e.target.value }))}
                      className={`${inputClass} h-11 text-[15px]`}
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
          <details className="text-[13px] text-muted">
            <summary className="cursor-pointer font-semibold">{t('whatWasSent')}</summary>
            <p className="mt-2 whitespace-pre-wrap">{check.sent}</p>
          </details>
          <PrimaryButton type="button" onClick={onWrite} pending={writing}>
            {missing ? t('writeAnyway') : t('writeButton')}
          </PrimaryButton>
        </section>
      )}

      {draft && (
        <section aria-labelledby="draft-output" aria-busy={writing} className="flex flex-col gap-2">
          <h2 id="draft-output" className="text-[16px] font-semibold">
            {t('outputTitle')}
          </h2>
          {draft.removed ? (
            <p className="text-[13px] text-lock-text">{t('removedCitations', { count: draft.removed })}</p>
          ) : null}
          <DraftPaper text={restore(draft.text, draft.map)} />
          <p className="text-[13px] text-muted">{t('lawyerDecides')}</p>
          {draft.id && (
            <div className="flex gap-2">
              <SecondaryButton
                type="button"
                onClick={() => navigator.clipboard?.writeText(restore(draft.text, draft.map))}
              >
                {t('copy')}
              </SecondaryButton>
              <Link
                href={`/drafts/${draft.id}`}
                className="flex h-12 items-center rounded-control border border-border px-4 text-[16px] font-medium"
              >
                {t('open')}
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
