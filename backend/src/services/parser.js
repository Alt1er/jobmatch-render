/**
 * Розбір файлів резюме (PDF / DOCX): витягування тексту, оцінка стажу, пошук назви посади.
 */
const path = require('path');
const mammoth = require('mammoth');
// Підключаємо напряму, щоб уникнути тестового коду у корені пакета pdf-parse
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const MAX_TEXT = 100000;

/** Визначає тип за розширенням та «магічними» байтами */
function detectType(buffer, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (ext === '.pdf' && buffer.slice(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (ext === '.docx' && buffer[0] === 0x50 && buffer[1] === 0x4b) return 'docx';
  return null;
}

function cleanText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\u0000/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT);
}

async function extractText(buffer, type) {
  if (type === 'pdf') {
    const data = await pdfParse(buffer);
    return cleanText(data.text);
  }
  if (type === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer });
    return cleanText(value);
  }
  throw new Error('Непідтримуваний тип файлу');
}

const EDU_WORDS = /університет|інститут|академі|коледж|ліцей|школа|бакалавр|магістр|освіта|навчання|university|college|bachelor|master|education|school|institute/i;
const ROLE_WORDS = /developer|engineer|designer|analyst|manager|devops|qa|tester|architect|scientist|розробник|програміст|інженер|аналітик|менеджер|дизайнер|тестувальник|архітектор|спеціаліст/i;

/** Оцінює загальний стаж роботи у роках за згадками та діапазонами дат */
function estimateYears(text) {
  const t = String(text || '');
  const nowYear = new Date().getFullYear();

  // 1) явні згадки: «досвід 5 років», «3+ years of experience»
  let explicit = 0;
  const unit = '(?:years?|yrs?|рок\\p{L}*|рік|лет|год\\p{L}*)';
  const num = '(\\d{1,2}(?:[.,]\\d)?)';
  const patterns = [
    new RegExp(`(?:досвід\\p{L}*|опыт\\p{L}*|experience)[^.\\n]{0,40}?(?<![\\d.,])${num}\\s*\\+?\\s*${unit}`, 'giu'),
    new RegExp(`(?<![\\d.,])${num}\\s*\\+?\\s*${unit}\\s*(?:of\\s+)?(?:commercial\\s+|professional\\s+|комерційного\\s+|професійного\\s+)?(?:досвід\\p{L}*|опыт\\p{L}*|experience)`, 'giu'),
  ];
  for (const re of patterns) {
    for (const m of t.matchAll(re)) {
      const v = parseFloat(m[1].replace(',', '.'));
      if (v > explicit && v <= 40) explicit = v;
    }
  }

  // 2) діапазони дат поза розділом освіти
  const lines = t.split('\n').map((l) => l.trim());
  const intervals = [];
  const rangeRe = /((?:19|20)\d{2})\s*(?:[-–—]|до|по|to)\s*((?:19|20)\d{2}|present|now|нині|теперішн\p{L}*|сьогодні|н\.\s?ч\.)/giu;
  const EDU_HEADING = /^(освіта|education|навчання|академічна освіта)(?![\p{L}\p{N}]).{0,20}$/iu;
  const OTHER_HEADING = /^(досвід|experience|work experience|навички|skills|про мене|about|summary|проєкти|projects|мови|languages|курси|courses|сертифікати|certificates|контакти|contacts|профіль|profile)(?![\p{L}\p{N}]).{0,25}$/iu;
  let inEdu = false;
  for (const line of lines) {
    if (EDU_HEADING.test(line)) inEdu = true;
    else if (OTHER_HEADING.test(line)) inEdu = false;
    if (inEdu || EDU_WORDS.test(line)) continue; // навчання не рахуємо як стаж
    for (const m of line.matchAll(rangeRe)) {
      const start = parseInt(m[1], 10);
      const end = /^(19|20)\d{2}$/.test(m[2]) ? parseInt(m[2], 10) : nowYear;
      if (end >= start && end - start <= 40 && end <= nowYear + 1) intervals.push([start, end]);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = null;
  let curEnd = null;
  for (const [s, e] of intervals) {
    if (curStart === null) {
      curStart = s;
      curEnd = e;
    } else if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  if (curStart !== null) total += curEnd - curStart;

  const years = Math.min(40, Math.max(explicit, total));
  return Math.round(years * 2) / 2;
}

/** Пропонує назву резюме: рядок із назвою посади або ім'я файлу */
function guessTitle(text, fileName) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 15);
  const hit = lines.find((l) => l.length <= 80 && ROLE_WORDS.test(l));
  if (hit) return hit;
  return path.basename(fileName || 'Резюме', path.extname(fileName || '')).slice(0, 120) || 'Резюме';
}

module.exports = { detectType, extractText, estimateYears, guessTitle };
