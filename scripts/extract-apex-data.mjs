#!/usr/bin/env node
/**
 * Pull the JEE/NEET syllabus and the practice-question bank out of an Apex
 * build (one big HTML file) and write them as data files MIS embeds.
 *
 *   node scripts/extract-apex-data.mjs <path-to-Apex.html> [out-dir]
 *
 * out-dir defaults to `src-tauri/data`. Writes:
 *   syllabus.json                       every NCERT chapter, with the bank chapter it maps to
 *   bank/{physics,chemistry,mathematics,biology}.json   chapters, topics and questions
 *
 * Apex keeps this data as JavaScript object literals, not JSON — unquoted keys,
 * comments, trailing commas — so each one is cut out by name and evaluated in an
 * empty `vm` context. Nothing else in the file runs.
 *
 * **Everything is validated before anything is written.** A file that fails a
 * check is refused with the list of problems and the output directory is left
 * as it was, so a half-broken Apex snapshot can never replace good data.
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import vm from 'node:vm';

// ── expected shape of the snapshot this was written against ──────────────────
// A different count is not necessarily wrong, but it must be looked at, so it
// refuses rather than guesses. Update these deliberately when Apex changes.
const EXPECTED = { questions: 4300, bankChapters: 86 };

/** Apex's subject keys → the names MIS already uses (see modules/auth/options.ts) */
const SUBJECTS = {
  Physics: { name: 'Physics', slug: 'phy', file: 'physics' },
  Chemistry: { name: 'Chemistry', slug: 'chem', file: 'chemistry' },
  Maths: { name: 'Mathematics', slug: 'math', file: 'mathematics' },
  Biology: { name: 'Biology', slug: 'bio', file: 'biology' },
};
const PUC = { '1st PUC': 1, '2nd PUC': 2 };

// ── cutting literals out of the source ───────────────────────────────────────

/**
 * Index just past the `}` or `]` that closes the bracket at `open`, skipping
 * strings, template literals and comments — the answers are full of LaTeX
 * braces, so counting raw characters would end the literal in the wrong place.
 */
function matchBracket(src, open) {
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const stack = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
    } else if (c === '/' && src[i + 1] === '/') {
      i = src.indexOf('\n', i);
      if (i < 0) break;
    } else if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2) + 1;
      if (i <= 0) break;
    } else if (pairs[c]) {
      stack.push(pairs[c]);
    } else if (c === '}' || c === ']' || c === ')') {
      if (stack.pop() !== c) throw new Error(`unbalanced '${c}' at offset ${i}`);
      if (stack.length === 0) return i + 1;
    }
  }
  throw new Error(`no closing bracket for offset ${open}`);
}

/** the object literal assigned by `<prefix> = {` (first match) */
function literalAfter(src, prefix) {
  const at = src.search(prefix);
  if (at < 0) throw new Error(`could not find ${prefix} in the Apex file`);
  const open = src.indexOf('{', at);
  return src.slice(open, matchBracket(src, open));
}

/** evaluate a literal with no globals, no timers, no way out */
const evaluate = (literal, label) => {
  try {
    return vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 5000 });
  } catch (e) {
    throw new Error(`${label} did not evaluate: ${e.message}`);
  }
};

// ── main ─────────────────────────────────────────────────────────────────────

const [, , inPath, outArg] = process.argv;
if (!inPath) {
  console.error('usage: node scripts/extract-apex-data.mjs <path-to-Apex.html> [out-dir]');
  process.exit(2);
}
const outDir = resolve(outArg ?? 'src-tauri/data');
const src = readFileSync(inPath, 'utf8');

const bankChapters = evaluate(literalAfter(src, /var PYQ_CHAPTERS\s*=/), 'PYQ_CHAPTERS');
const bankQuestions = evaluate(literalAfter(src, /var PYQ_QUESTIONS\s*=/), 'PYQ_QUESTIONS');
const notesMap = evaluate(literalAfter(src, /const JEE_NOTESAPP_MAP\s*=/), 'JEE_NOTESAPP_MAP');
const rich = {};
for (const key of Object.keys(SUBJECTS)) {
  rich[key] = evaluate(
    literalAfter(src, new RegExp(`jeeNeetSyllabusData\\['${key}'\\]\\s*=`)),
    `jeeNeetSyllabusData['${key}']`,
  );
}

/** typographic quotes, spacing and case folded — for matching names, never for storing them */
const looseKey = (s) =>
  s
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const problems = [];
/** question topics missing from their chapter's topic list, with counts */
const unlisted = new Map();
const warnings = [];
const fail = (msg) => problems.push(msg);

// ── the bank ─────────────────────────────────────────────────────────────────

const banks = {}; // file → { subject, chapters }
const bankIndex = new Map(); // bank chapter id → subject key
const questionIds = new Set();
let questionCount = 0;

for (const [key, meta] of Object.entries(SUBJECTS)) {
  const chapters = bankChapters[key];
  if (!Array.isArray(chapters)) {
    fail(`PYQ_CHAPTERS has no ${key} list`);
    continue;
  }
  banks[meta.file] = {
    subject: meta.name,
    chapters: chapters.map((ch) => {
      if (bankIndex.has(ch.id)) fail(`bank chapter id ${ch.id} is used twice`);
      bankIndex.set(ch.id, key);
      // Apex spells the same topic with a curly apostrophe in one place and a
      // straight one in the other ("Bohr’s" / "Bohr's"). Match loosely, then
      // store the chapter's own spelling so the app can compare exactly.
      const topicByKey = new Map((ch.topics ?? []).map((t) => [looseKey(t.name), t.name]));
      const raw = bankQuestions[ch.id];
      if (!Array.isArray(raw) || raw.length === 0) fail(`${ch.id} (${ch.title}) has no questions`);

      const questions = (raw ?? []).map((q, i) => {
        const id = `${ch.id}-${String(i + 1).padStart(3, '0')}`;
        const where = `${id}`;
        if (questionIds.has(id)) fail(`${where}: duplicate question id`);
        questionIds.add(id);
        if (typeof q.q !== 'string' || !q.q.trim()) fail(`${where}: empty question text`);
        if (!Array.isArray(q.options) || q.options.length !== 4)
          fail(`${where}: expected 4 options, found ${q.options?.length ?? 0}`);
        else if (q.options.some((o) => typeof o !== 'string' || !o.trim()))
          fail(`${where}: an option is empty`);
        if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= (q.options?.length ?? 0))
          fail(`${where}: correctIndex ${q.correctIndex} is out of range`);
        if (typeof q.answer !== 'string' || !q.answer.trim()) fail(`${where}: empty worked answer`);
        if (!['Easy', 'Medium', 'Hard'].includes(q.difficulty))
          fail(`${where}: unknown difficulty ${JSON.stringify(q.difficulty)}`);
        if (typeof q.topic !== 'string' || !q.topic.trim()) fail(`${where}: no topic`);
        // Apex groups by the question's own topic; in some chapters the listed
        // topics were renamed and the questions weren't. The questions win —
        // they are what gets practised — and the mismatch is reported.
        const listed = topicByKey.get(looseKey(q.topic ?? ''));
        const topic = listed ?? String(q.topic ?? '').trim();
        if (!listed) unlisted.set(`${ch.id}: ${topic}`, (unlisted.get(`${ch.id}: ${topic}`) ?? 0) + 1);
        const points = q.points ?? 4;
        const negative = q.negativeMarks ?? 0;
        if (!(points > 0) || !(negative >= 0)) fail(`${where}: bad marks ${points}/-${negative}`);
        questionCount++;
        return {
          id,
          topic,
          difficulty: q.difficulty,
          text: q.q,
          options: q.options,
          correct: q.correctIndex,
          answer: q.answer,
          tip: q.examTip ?? '',
          points,
          negative,
          source: q.sourceType ?? 'original',
        };
      });

      return {
        id: ch.id,
        num: ch.num,
        title: ch.title,
        teaser: ch.teaser ?? '',
        // the topics that actually have questions, in the order they first appear,
        // with Apex's teaser where the listed topic matches
        topics: [...new Set(questions.map((q) => q.topic))].map((name) => ({
          name,
          teaser: (ch.topics ?? []).find((t) => t.name === name)?.teaser ?? '',
        })),
        questions,
      };
    }),
  };
}

for (const id of Object.keys(bankQuestions))
  if (!bankIndex.has(id)) fail(`PYQ_QUESTIONS has ${id}, which no chapter lists`);
if (questionCount !== EXPECTED.questions)
  fail(`expected ${EXPECTED.questions} questions, found ${questionCount}`);
if (bankIndex.size !== EXPECTED.bankChapters)
  fail(`expected ${EXPECTED.bankChapters} bank chapters, found ${bankIndex.size}`);

// ── the syllabus ─────────────────────────────────────────────────────────────

const syllabus = [];
const mapped = new Set();
for (const [key, meta] of Object.entries(SUBJECTS)) {
  const details = rich[key]?.topicDetails;
  if (!details) {
    fail(`jeeNeetSyllabusData has no ${key} topicDetails`);
    continue;
  }
  const map = notesMap[key] ?? {};
  for (const [year, list] of Object.entries(details)) {
    const puc = PUC[year];
    if (!puc) {
      fail(`${key}: unknown year ${year}`);
      continue;
    }
    for (const entry of list) {
      const m = /^(\d+)\.\s*(.+)$/.exec(entry.chapter);
      if (!m) {
        fail(`${key} ${year}: chapter ${JSON.stringify(entry.chapter)} has no number`);
        continue;
      }
      const num = Number(m[1]);
      // Apex's map is keyed by "<number>. <title>", and a chapter that exists in
      // both years under different numbers ("Relations and Functions",
      // "Probability") only got an entry for one of them. Fall back to the same
      // title under any number in this subject.
      const sameTitle = Object.entries(map).find(([k]) => k.replace(/^\d+\.\s*/, '') === m[2].trim());
      const bankId = map[entry.chapter] ?? sameTitle?.[1] ?? null;
      if (!map[entry.chapter] && bankId)
        warnings.push(`linked ${meta.name} "${entry.chapter}" (${year}) to ${bankId} by title`);
      if (bankId && bankIndex.get(bankId) !== key)
        fail(`${key} "${entry.chapter}" maps to ${bankId}, which is not a ${key} bank chapter`);
      if (bankId) mapped.add(bankId);
      else warnings.push(`no question bank for ${meta.name} "${entry.chapter}" (${year})`);
      // Maths is JEE-only and Biology NEET-only; Apex marks NEET-only chapters
      // in Physics/Chemistry with examRelevance 'neet'.
      const exams =
        key === 'Maths' ? ['jee'] : key === 'Biology' ? ['neet'] : entry.examRelevance === 'neet' ? ['neet'] : ['jee', 'neet'];
      syllabus.push({
        id: `${meta.slug}-${puc}-${String(num).padStart(2, '0')}`,
        subject: meta.name,
        puc,
        num,
        title: m[2].trim(),
        priority: entry.priority ?? 3,
        exams,
        bank_id: bankId,
      });
    }
  }
}

const syllabusIds = new Set();
for (const s of syllabus) {
  if (syllabusIds.has(s.id)) fail(`syllabus id ${s.id} is used twice`);
  syllabusIds.add(s.id);
}
for (const [key, map] of Object.entries(notesMap))
  for (const title of Object.keys(map))
    if (!syllabus.some((s) => SUBJECTS[key] && s.subject === SUBJECTS[key].name && `${s.num}. ${s.title}` === title))
      fail(`JEE_NOTESAPP_MAP names ${key} "${title}", which is not in the syllabus`);
// Not a fault: these are JEE-only chapters outside the NCERT list (practical
// chemistry, experimental skills). They stay in the bank and can be practised.
for (const id of bankIndex.keys())
  if (!mapped.has(id)) warnings.push(`bank chapter ${id} has no NCERT syllabus chapter (still practisable)`);

// ── report, then write or refuse ─────────────────────────────────────────────

console.log(`questions      ${questionCount}`);
console.log(`bank chapters  ${bankIndex.size}`);
for (const b of Object.values(banks))
  console.log(
    `  ${b.subject.padEnd(12)} ${String(b.chapters.length).padStart(3)} chapters, ${b.chapters.reduce((n, c) => n + c.questions.length, 0)} questions`,
  );
console.log(`syllabus       ${syllabus.length} chapters, ${syllabus.filter((s) => s.bank_id).length} with a bank`);
const sources = {};
for (const b of Object.values(banks))
  for (const c of b.chapters) for (const q of c.questions) sources[q.source] = (sources[q.source] ?? 0) + 1;
console.log(`sources        ${JSON.stringify(sources)}`);
for (const w of warnings) console.log(`note: ${w}`);
if (unlisted.size) {
  const byChapter = {};
  for (const [k, n] of unlisted) {
    const ch = k.split(':')[0];
    byChapter[ch] = (byChapter[ch] ?? 0) + n;
  }
  console.log(
    `note: ${[...unlisted.values()].reduce((a, b) => a + b, 0)} questions carry a topic their chapter doesn't list (kept as-is): ${JSON.stringify(byChapter)}`,
  );
}

if (problems.length) {
  console.error(`\nRefused: ${problems.length} problem(s). Nothing was written.`);
  for (const p of problems.slice(0, 50)) console.error(`  - ${p}`);
  if (problems.length > 50) console.error(`  … and ${problems.length - 50} more`);
  process.exit(1);
}

// Write into a sibling temp dir and swap it in, so a crash half way through
// cannot leave a mix of old and new files.
const tmp = `${outDir}.tmp`;
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(tmp, 'bank'), { recursive: true });
writeFileSync(join(tmp, 'syllabus.json'), JSON.stringify(syllabus, null, 1) + '\n');
for (const [file, bank] of Object.entries(banks))
  writeFileSync(join(tmp, 'bank', `${file}.json`), JSON.stringify(bank) + '\n');
rmSync(outDir, { recursive: true, force: true });
renameSync(tmp, outDir);
console.log(`\nWrote ${outDir}`);
