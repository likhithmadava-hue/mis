import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import * as XLSX from 'xlsx';

import { todayIso } from '../../core/dates';
import {
  DIFFICULTIES,
  MISTAKE_REASONS,
  type Difficulty,
  type MarkLogbookEntry,
  type MistakeReason,
} from '../../core/db';

/**
 * Reading marks out of a spreadsheet the user already keeps — and writing them
 * back out again.
 *
 * The hard part isn't the file format: SheetJS handles .xlsx and .csv through
 * the same call. It's that nobody's sheet uses our column names, our date
 * format, or our nine error types. So: guess the mapping, let the user correct
 * it, and coerce every value defensively rather than trusting the cell.
 */

/** the fields an imported row can fill in; `id` is ours, everything else maps */
export type Field = keyof Omit<MarkLogbookEntry, 'id'>;

export interface FieldSpec {
  field: Field;
  label: string;
  /** without these a row is meaningless, so the import button stays disabled */
  required: boolean;
  /** lower-case header fragments that mean this field */
  aliases: string[];
  hint: string;
}

export const FIELD_SPECS: FieldSpec[] = [
  {
    field: 'date',
    label: 'Date',
    required: true,
    aliases: ['date', 'day', 'on', 'when', 'exam date', 'test date'],
    hint: 'when you sat the paper',
  },
  {
    field: 'subject',
    label: 'Subject',
    required: true,
    aliases: ['subject', 'sub', 'sub.', 'paper', 'course'],
    hint: 'Physics, Chemistry…',
  },
  {
    field: 'chapter',
    label: 'Chapter',
    required: false,
    aliases: ['chapter', 'chap', 'topic', 'unit', 'lesson', 'ch'],
    hint: 'Kinematics, Mole Concept…',
  },
  {
    field: 'score',
    label: 'Score',
    required: true,
    aliases: ['score', 'marks', 'mark', 'obtained', 'got', 'scored', 'result'],
    hint: 'marks you actually got',
  },
  {
    field: 'max_score',
    label: 'Max score',
    required: true,
    aliases: ['max', 'max score', 'out of', 'total', 'maximum', 'full marks', 'outof'],
    hint: 'marks the paper was out of',
  },
  {
    field: 'mistake_reason',
    label: 'Error type',
    required: false,
    aliases: ['error', 'error type', 'mistake', 'reason', 'mistake reason', 'why', 'cause'],
    hint: 'defaults to Other',
  },
  {
    field: 'difficulty',
    label: 'Difficulty',
    required: false,
    aliases: ['difficulty', 'diff', 'level', 'hardness'],
    hint: 'defaults to Medium',
  },
  {
    field: 'time_spent',
    label: 'Time (min)',
    required: false,
    aliases: ['time', 'time spent', 'minutes', 'mins', 'duration'],
    hint: 'defaults to 0',
  },
  {
    field: 'grade',
    label: 'Grade',
    required: false,
    aliases: ['grade', 'gr', 'band'],
    hint: 'derived from the score if absent',
  },
  {
    field: 'notes',
    label: 'Notes',
    required: false,
    aliases: ['notes', 'note', 'remark', 'remarks', 'comment', 'comments', 'action'],
    hint: 'what you’ll do differently',
  },
];

/** no column chosen — a real header could be an empty string, so use a sentinel */
export const UNMAPPED = '__unmapped__';

export type Mapping = Record<Field, string>;

export interface SheetData {
  sheetNames: string[];
  /** the sheet currently being read */
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ');

// ── reading ───────────────────────────────────────────────────────────────

/**
 * Parse a File into rows.
 *
 * The file comes from an ordinary `<input type="file">` rather than Tauri's
 * dialog plugin, which is not laziness: the input hands back a `File` the
 * webview can read directly, so importing a sheet needs no filesystem
 * permission at all. MIS can be pointed at a spreadsheet anywhere on the disk
 * without ever being granted the ability to go looking for one.
 *
 * The two formats are read deliberately differently:
 *
 * - **.xlsx** — `cellDates` on, so a real date cell arrives as a `Date`.
 *   Without it Excel hands back serial numbers (45123) and we'd be guessing the
 *   epoch. A genuine date cell is unambiguous, so we trust it.
 * - **.csv** — read raw, as text. Left to itself SheetJS "helpfully" parses
 *   `07/08/2026` into a date **month-first**, turning 7 August into 8 July with
 *   no warning. A CSV has no cell types, so the convention is the author's, not
 *   SheetJS's — we keep the string and let `toIsoDate` apply day-first below.
 */
export async function readSheet(file: File, sheetName?: string): Promise<SheetData> {
  const isCsv = /\.csv$/i.test(file.name);
  const book = isCsv
    ? XLSX.read(await file.text(), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { cellDates: true });

  if (book.SheetNames.length === 0) throw new Error('That file has no sheets in it.');

  const name = sheetName && book.SheetNames.includes(sheetName) ? sheetName : book.SheetNames[0];
  const sheet = book.Sheets[name];

  // defval keeps blank cells present so a column that is empty near the top
  // still shows up in the header list
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  // sheet_to_json only reports keys that exist on each row; read the header row
  // directly so the mapping list matches the sheet exactly, in order
  const headerRow = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })[0] ?? [];
  const headers = headerRow.map((h) => String(h ?? '').trim()).filter((h) => h !== '');

  return { sheetNames: book.SheetNames, sheetName: name, headers, rows };
}

// ── mapping ───────────────────────────────────────────────────────────────

/** best-guess column for each field: exact alias match first, then contains */
export function autoMap(headers: string[]): Mapping {
  const mapping = {} as Mapping;
  const taken = new Set<string>();

  for (const spec of FIELD_SPECS) {
    const exact = headers.find((h) => !taken.has(h) && spec.aliases.includes(norm(h)));
    const partial =
      exact ??
      headers.find(
        (h) =>
          !taken.has(h) && spec.aliases.some((a) => norm(h).includes(a) || a.includes(norm(h))),
      );

    mapping[spec.field] = partial ?? UNMAPPED;
    if (partial) taken.add(partial);
  }

  return mapping;
}

// ── coercion ──────────────────────────────────────────────────────────────

/**
 * Dates arrive as a Date (a real Excel cell), a serial number, or free text.
 * For ambiguous numeric text like 07/08/2026 we read **day-first** — this app
 * is used in India, where that is what people write.
 */
export function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    // the cell is a local wall-clock date; toISOString would shift it a day
    // backwards for anyone east of UTC, so build the string by hand
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number' && isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  // already ISO
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  // d/m/y or d-m-y, two- or four-digit year
  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = String(2000 + Number(y));
    // a "day" over 12 can only be a day, so a leading value ≤12 with a second
    // value >12 means the sheet is month-first after all
    if (Number(d) <= 12 && Number(m) > 12) [d, m] = [m, d];
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const loose = new Date(text);
  if (!isNaN(loose.getTime())) {
    return `${loose.getFullYear()}-${String(loose.getMonth() + 1).padStart(2, '0')}-${String(
      loose.getDate(),
    ).padStart(2, '0')}`;
  }

  return null;
}

/** pulls a number out of "38", "38/50", "38 marks", "  38.5 " */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  const match = String(value ?? '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

const DIFFICULTY_ALIASES: Record<string, Difficulty> = {
  e: 'Easy', easy: 'Easy', low: 'Easy', simple: 'Easy', basic: 'Easy',
  m: 'Medium', medium: 'Medium', mid: 'Medium', moderate: 'Medium', average: 'Medium',
  h: 'Hard', hard: 'Hard', high: 'Hard', tough: 'Hard', difficult: 'Hard',
};

export function toDifficulty(value: unknown): Difficulty {
  const key = norm(String(value ?? ''));
  const exact = DIFFICULTIES.find((d) => norm(d) === key);
  if (exact) return exact;
  return DIFFICULTY_ALIASES[key] ?? 'Medium';
}

const REASON_ALIASES: Record<string, MistakeReason> = {
  concept: 'Conceptual', conceptual: 'Conceptual', theory: 'Conceptual', understanding: 'Conceptual',
  calc: 'Calculation', calculation: 'Calculation', arithmetic: 'Calculation', maths: 'Calculation',
  careless: 'Careless', silly: 'Careless', carelessness: 'Careless', slip: 'Careless',
  reading: 'Reading', misread: 'Reading', comprehension: 'Reading',
  unit: 'Unit', units: 'Unit', conversion: 'Unit',
  sign: 'Sign', signs: 'Sign',
  formula: 'Formula Recall', 'formula recall': 'Formula Recall', recall: 'Formula Recall', memory: 'Formula Recall',
  time: 'Time Pressure', 'time pressure': 'Time Pressure', rushed: 'Time Pressure', slow: 'Time Pressure',
};

export function toReason(value: unknown): MistakeReason {
  const key = norm(String(value ?? ''));
  const exact = MISTAKE_REASONS.find((r) => norm(r) === key);
  if (exact) return exact;
  return REASON_ALIASES[key] ?? 'Other';
}

/** the grade bands the Log a Paper form offers, for sheets that omit a grade */
function gradeFor(score: number, max: number): string {
  if (max <= 0) return 'F';
  const pct = (score / max) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

// ── building ──────────────────────────────────────────────────────────────

export type Candidate = Omit<MarkLogbookEntry, 'id'>;

export interface RowProblem {
  /** 1-based row number as the user sees it in Excel, header included */
  row: number;
  reason: string;
}

export interface BuildResult {
  entries: Candidate[];
  problems: RowProblem[];
  duplicates: number;
}

/** two records are "the same paper" if these line up */
const fingerprint = (e: Candidate | MarkLogbookEntry) =>
  [e.date, norm(e.subject), norm(e.chapter), e.score, e.max_score].join('|');

/**
 * Turn mapped rows into entries, dropping the ones that can't be salvaged and
 * the ones already in the database.
 *
 * **Nothing is written here.** The caller shows this to the user first — how
 * many rows are good, how many are duplicates, and exactly which row numbers
 * were dropped and why. An importer that silently ate four rows out of two
 * hundred would be worse than one that refused the file.
 */
export function buildEntries(
  rows: Record<string, unknown>[],
  mapping: Mapping,
  existingFingerprints: string[],
): BuildResult {
  const entries: Candidate[] = [];
  const problems: RowProblem[] = [];
  const seen = new Set(existingFingerprints);
  let duplicates = 0;

  const cell = (row: Record<string, unknown>, field: Field) => {
    const column = mapping[field];
    return column === UNMAPPED ? '' : row[column];
  };

  rows.forEach((row, i) => {
    const rowNumber = i + 2; // +1 for the header, +1 because Excel is 1-based

    const subject = String(cell(row, 'subject') ?? '').trim();
    const date = toIsoDate(cell(row, 'date'));
    const score = toNumber(cell(row, 'score'));
    const max = toNumber(cell(row, 'max_score'));

    // a wholly blank row is padding at the bottom of the sheet, not an error
    const blank =
      !subject &&
      date === null &&
      score === null &&
      max === null &&
      !String(cell(row, 'chapter') ?? '').trim();
    if (blank) return;

    if (!subject) return void problems.push({ row: rowNumber, reason: 'no subject' });
    if (date === null) return void problems.push({ row: rowNumber, reason: 'date not understood' });
    if (score === null) return void problems.push({ row: rowNumber, reason: 'no score' });
    if (max === null || max <= 0 || max > 10000)
      return void problems.push({ row: rowNumber, reason: 'invalid max score (must be > 0 and <= 10000)' });
    if (score < 0 || score > max)
      return void problems.push({ row: rowNumber, reason: 'score must be between 0 and max score' });

    const rawTime = toNumber(cell(row, 'time_spent')) ?? 0;
    if (rawTime < 0 || rawTime > 1440)
      return void problems.push({ row: rowNumber, reason: 'time spent must be between 0 and 1440 minutes' });

    const gradeCell = String(cell(row, 'grade') ?? '').trim();

    const entry: Candidate = {
      date,
      subject,
      chapter: String(cell(row, 'chapter') ?? '').trim(),
      grade: gradeCell || gradeFor(score, max),
      score,
      max_score: max,
      difficulty: toDifficulty(cell(row, 'difficulty')),
      time_spent: rawTime,
      mistake_reason: toReason(cell(row, 'mistake_reason')),
      notes: String(cell(row, 'notes') ?? '').trim(),
    };

    const print = fingerprint(entry);
    if (seen.has(print)) {
      duplicates++;
      return;
    }
    seen.add(print);
    entries.push(entry);
  });

  return { entries, problems, duplicates };
}

// ── exporting ─────────────────────────────────────────────────────────────

const EXPORT_COLUMNS: { header: string; get: (e: MarkLogbookEntry) => string | number }[] = [
  { header: 'Date', get: (e) => e.date },
  { header: 'Subject', get: (e) => e.subject },
  { header: 'Chapter', get: (e) => e.chapter },
  { header: 'Grade', get: (e) => e.grade },
  { header: 'Score', get: (e) => e.score },
  { header: 'Max score', get: (e) => e.max_score },
  { header: 'Marks lost', get: (e) => Math.max(0, e.max_score - e.score) },
  { header: 'Difficulty', get: (e) => e.difficulty },
  { header: 'Error type', get: (e) => e.mistake_reason },
  { header: 'Time (min)', get: (e) => e.time_spent },
  { header: 'Notes', get: (e) => e.notes },
];

function sheetFrom(entries: MarkLogbookEntry[]) {
  const rows = entries.map((e) =>
    Object.fromEntries(EXPORT_COLUMNS.map((c) => [c.header, c.get(e)])),
  );
  const sheet = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS.map((c) => c.header) });
  sheet['!cols'] = EXPORT_COLUMNS.map((c) => ({ wch: Math.max(10, c.header.length + 2) }));
  return sheet;
}

/**
 * Ask where to put a file, then put it there.
 *
 * The old version built a Blob and clicked an invisible `<a download>`, which
 * is how the web saves a file and not how an application does. An installed app
 * opens the system Save dialog: the user sees where the file is going, names
 * it, and can put it somewhere they will find it again. Returns the path
 * written, or null if they cancelled — cancelling is not an error.
 */
async function saveAs(
  defaultName: string,
  extension: string,
  description: string,
  write: (path: string) => Promise<void>,
): Promise<string | null> {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: description, extensions: [extension] }],
  });
  if (!path) return null;
  await write(path);
  return path;
}

export const exportCsv = (entries: MarkLogbookEntry[]) =>
  saveAs(`mis-mistakes-${todayIso()}.csv`, 'csv', 'CSV spreadsheet', (path) =>
    // The BOM is what makes Excel open a UTF-8 CSV without mangling accents.
    // Without it, a chapter name with an é becomes mojibake on the way in.
    writeTextFile(path, '﻿' + XLSX.utils.sheet_to_csv(sheetFrom(entries))),
  );

const workbookBytes = (entries: MarkLogbookEntry[]) => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheetFrom(entries), 'Mistakes');
  // `array` rather than `file`: SheetJS's own writeFile reaches for the DOM's
  // download mechanism, which is exactly what we are replacing.
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
};

export const exportXlsx = (entries: MarkLogbookEntry[]) =>
  saveAs(`mis-mistakes-${todayIso()}.xlsx`, 'xlsx', 'Excel workbook', (path) =>
    writeFile(path, workbookBytes(entries)),
  );

/** our own backup format — the only export that can be read back in */
export const exportJson = (entries: MarkLogbookEntry[]) =>
  saveAs(`mis-mistakes-${todayIso()}.json`, 'json', 'JSON backup', (path) =>
    writeTextFile(path, JSON.stringify(entries, null, 2)),
  );

/** an empty sheet with the right headers, for starting from scratch */
export const exportTemplate = () => {
  const example: MarkLogbookEntry = {
    id: '',
    date: todayIso(),
    subject: 'Physics',
    chapter: 'Kinematics',
    grade: 'B',
    score: 38,
    max_score: 50,
    difficulty: 'Medium',
    time_spent: 60,
    mistake_reason: 'Careless',
    notes: 'Re-read the question before solving.',
  };
  return saveAs('mis-import-template.xlsx', 'xlsx', 'Excel workbook', (path) =>
    writeFile(path, workbookBytes([example])),
  );
};
