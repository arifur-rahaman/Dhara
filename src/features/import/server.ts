import 'server-only';
import { z } from 'zod';
import { dbDate } from '@/lib/dates';
import { uuidv7 } from '@/lib/uuid';
import type { Ctx } from '@/server/authz';
import type { Tx } from '@/server/db/client';
import { visibleCasesWhere } from '@/features/cases/queries';
import {
  caseTypes,
  importFields,
  MAX_CELL,
  MAX_COLUMNS,
  MAX_ROWS,
  normalizeText,
  parseCaseType,
  parseDate,
  parseSide,
  parseYear,
  sides,
  splitNumberYear,
  type CaseType,
  type Side,
} from './fields';

/** What the browser sends: the data rows (header removed), the column mapping and the fallbacks. */
export const importInput = z.object({
  rows: z
    .array(z.array(z.string().max(MAX_CELL)).max(MAX_COLUMNS))
    .min(1)
    .max(MAX_ROWS),
  mapping: z.partialRecord(
    z.enum(importFields),
    z
      .number()
      .int()
      .min(0)
      .max(MAX_COLUMNS - 1),
  ),
  defaults: z.object({
    courtId: z.uuid().nullable(),
    type: z.enum(caseTypes),
    ourSide: z.enum(sides),
  }),
  assignee: z.uuid().nullable(),
});
export type ImportInput = z.infer<typeof importInput>;

export type RowError = 'number' | 'year' | 'court' | 'date' | 'tooLong';
export type PreviewRow = {
  /** Line in the file, counting the header as line 1. */
  line: number;
  status: 'ok' | 'duplicate' | 'error';
  errors: RowError[];
  number: string;
  year: string;
  court: { nameBn: string; nameEn: string } | null;
  clientName: string | null;
  nextDate: string | null;
};

type ReadyRow = {
  line: number;
  number: string;
  year: string;
  courtId: string;
  type: CaseType;
  ourSide: Side;
  courtNo: string | null;
  clientName: string | null;
  partiesText: string | null;
  opposingCounsel: string | null;
  nextDate: string | null;
  note: string | null;
};

const limits = { courtNo: 20, clientName: 120, partiesText: 300, opposingCounsel: 120, note: 1000, number: 30 };

/**
 * Checks every row the same way for the preview and for saving.
 * Courts must be ones this chamber can pick (Supreme Court, its district, its own).
 * Duplicates: same number, year and court as a case this person can see, or as an earlier row in the file.
 */
export async function checkRows(tx: Tx, ctx: Ctx, input: ImportInput) {
  const chamber = await tx.chamber.findUniqueOrThrow({ where: { id: ctx.chamberId }, select: { district: true } });
  const courts = await tx.court.findMany({
    where: { OR: [{ level: 'supreme' }, { district: chamber.district }, { chamberId: ctx.chamberId }] },
    select: { id: true, nameBn: true, nameEn: true },
  });
  const courtById = new Map(courts.map((c) => [c.id, c]));
  const courtByName = new Map<string, (typeof courts)[number]>();
  for (const c of courts) {
    courtByName.set(normalizeText(c.nameEn), c);
    courtByName.set(normalizeText(c.nameBn), c);
  }
  const fallbackCourt = input.defaults.courtId ? (courtById.get(input.defaults.courtId) ?? null) : null;

  const existing = await tx.case.findMany({
    where: visibleCasesWhere(ctx),
    select: { number: true, year: true, courtId: true },
  });
  const key = (number: string, year: string, courtId: string) => `${normalizeText(number)}|${year}|${courtId}`;
  const seen = new Set(existing.map((c) => key(c.number, c.year, c.courtId)));

  const { mapping } = input;
  const cell = (row: string[], field: keyof typeof mapping) => {
    const index = mapping[field];
    return index === undefined ? '' : (row[index] ?? '').trim();
  };
  const text = (row: string[], field: keyof typeof limits & keyof typeof mapping) => cell(row, field) || null;

  const preview: PreviewRow[] = [];
  const ready: ReadyRow[] = [];

  input.rows.forEach((row, i) => {
    const errors: RowError[] = [];
    const rawNumber = cell(row, 'number');
    const split = mapping.year === undefined ? splitNumberYear(rawNumber) : { number: rawNumber, year: null };
    const number = split.number;
    const year = mapping.year === undefined ? split.year : parseYear(cell(row, 'year'));
    if (!number) errors.push('number');
    if (!year) errors.push('year');

    const courtText = cell(row, 'court');
    const court = (courtText ? courtByName.get(normalizeText(courtText)) : undefined) ?? fallbackCourt;
    if (!court) errors.push('court');

    const dateText = cell(row, 'nextDate');
    const nextDate = dateText ? parseDate(dateText) : null;
    if (dateText && !nextDate) errors.push('date');

    const values = {
      number,
      courtNo: text(row, 'courtNo'),
      clientName: text(row, 'clientName'),
      partiesText: text(row, 'partiesText'),
      opposingCounsel: text(row, 'opposingCounsel'),
      note: text(row, 'note'),
    };
    if ((Object.keys(limits) as (keyof typeof limits)[]).some((k) => (values[k]?.length ?? 0) > limits[k])) {
      errors.push('tooLong');
    }

    let status: PreviewRow['status'] = errors.length ? 'error' : 'ok';
    if (status === 'ok') {
      const k = key(number, year!, court!.id);
      if (seen.has(k)) status = 'duplicate';
      seen.add(k);
    }

    preview.push({
      line: i + 2,
      status,
      errors,
      number,
      year: year ?? '',
      court: court ? { nameBn: court.nameBn, nameEn: court.nameEn } : null,
      clientName: values.clientName,
      nextDate,
    });
    if (status === 'ok') {
      ready.push({
        line: i + 2,
        number,
        year: year!,
        courtId: court!.id,
        type: parseCaseType(cell(row, 'type')) ?? input.defaults.type,
        ourSide: parseSide(cell(row, 'ourSide')) ?? input.defaults.ourSide,
        courtNo: values.courtNo,
        clientName: values.clientName,
        partiesText: values.partiesText,
        opposingCounsel: values.opposingCounsel,
        nextDate,
        note: values.note,
      });
    }
  });
  return { preview, ready };
}

/**
 * Saves the rows that passed: clients by name (reusing a client with the same name), cases, and each
 * row's date as a hearing. One transaction: all or nothing.
 */
export async function saveRows(tx: Tx, ctx: Ctx, rows: ReadyRow[], assigneeMembershipId: string | null) {
  const clients = await tx.client.findMany({
    where: { chamberId: ctx.chamberId, deletedAt: null },
    select: { id: true, displayName: true },
  });
  const clientIdByName = new Map(clients.map((c) => [c.displayName.trim().toLowerCase(), c.id]));
  const newClients: { id: string; chamberId: string; displayName: string; createdBy: string }[] = [];
  const clientIdFor = (name: string | null) => {
    if (!name) return null;
    const k = name.trim().toLowerCase();
    let id = clientIdByName.get(k);
    if (!id) {
      id = uuidv7();
      clientIdByName.set(k, id);
      newClients.push({ id, chamberId: ctx.chamberId, displayName: name.trim(), createdBy: ctx.userId });
    }
    return id;
  };

  const cases = rows.map((r) => ({
    id: uuidv7(),
    chamberId: ctx.chamberId,
    type: r.type,
    number: r.number,
    year: r.year,
    courtId: r.courtId,
    courtNo: r.courtNo,
    ourSide: r.ourSide,
    clientId: clientIdFor(r.clientName),
    partiesText: r.partiesText,
    opposingCounsel: r.opposingCounsel,
    note: r.note,
    assigneeMembershipId,
    createdBy: ctx.userId,
  }));
  const hearings = rows.flatMap((r, i) =>
    r.nextDate
      ? [{ chamberId: ctx.chamberId, caseId: cases[i].id, date: dbDate(r.nextDate), addedBy: ctx.userId }]
      : [],
  );

  if (newClients.length) await tx.client.createMany({ data: newClients });
  await tx.case.createMany({ data: cases });
  if (hearings.length) await tx.hearing.createMany({ data: hearings });
  return { cases: cases.length, clients: newClients.length, hearings: hearings.length };
}
