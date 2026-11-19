/**
 * Текстові утиліти: нормалізація, токенізація та спрощений стемінг
 * для української, російської та англійської мов.
 */

const STOPWORDS = new Set(
  (
    // англійська
    'the a an and or of to in for with on at by is are was were be been as from that this these those it we you our your ' +
    'will have has had can could must should would may not but if their they them his her its into over under about using ' +
    'use used work working works also more most such other any all etc including include well new per via ' +
    // українська
    'і й та в у на з із зі до для по про що як це цей ця ці або але не ми ви ми наш наша наші ваш ваша ваші від за при між ' +
    'також є бути буде мати має можна потрібно ще вже якщо чи так тому який яка які яке його її їх вони він вона ' +
    'під над без через після перед серед тощо та ін ' +
    // російська
    'и в на с для по что как это или но не мы вы от за при также есть быть будет иметь может нужно еще уже если'
  ).split(/\s+/)
);

// слова-«шум» у назвах посад (рівень, загальне слово «розробник» тощо)
const TITLE_NOISE = new Set(
  (
    'junior middle mid senior lead principal trainee intern jr sr ' +
    'джуніор джун мідл сеньйор сеніор лід стажер стажист ' +
    'в у на для та і й and or of the a an at ' +
    'remote віддалено'
  ).split(/\s+/)
);

const DEV_WORD = /^(розробни\p{L}*|програміст\p{L}*|developer\p{L}*|engineer\p{L}*|інженер\p{L}*|programmer\p{L}*|dev|девелопер\p{L}*)$/u;

function normalizeText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[’`ʼ]/g, "'")
    .replace(/front[\s-]?end/g, 'frontend')
    .replace(/back[\s-]?end/g, 'backend')
    .replace(/full[\s-]?stack/g, 'fullstack')
    .replace(/фронт[\s-]?енд/g, 'frontend')
    .replace(/бек[\s-]?енд/g, 'backend')
    .replace(/фул[\s-]?стек/g, 'fullstack')
    .replace(/qa[\s-]?інженер\p{L}*/gu, 'qa')
    .replace(/тестувальни\p{L}*/gu, 'qa');
}

function stemLatin(w) {
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

function stemToken(w) {
  if (DEV_WORD.test(w)) return 'dev';
  if (/^\p{Script=Cyrillic}+$/u.test(w)) return w.length > 5 ? w.slice(0, 5) : w;
  if (/^[a-z]+$/.test(w)) return stemLatin(w);
  return w;
}

function rawTokens(text) {
  const norm = normalizeText(text);
  const found = norm.match(/[\p{L}\p{N}][\p{L}\p{N}+#.'-]*/gu) || [];
  const out = [];
  for (let w of found) {
    w = w.replace(/'/g, '').replace(/[.\-]+$/g, '');
    if (w.length < 2) continue;
    if (/^\d+$/.test(w)) continue;
    out.push(w);
  }
  return out;
}

/** Токени для TF-IDF: без стоп-слів, зі стемінгом */
function tokenize(text) {
  return rawTokens(text)
    .filter((w) => !STOPWORDS.has(w))
    .map(stemToken);
}

/** Токени назви посади: без рівня та слова «розробник» */
function titleTokens(text) {
  return rawTokens(text)
    .filter((w) => !STOPWORDS.has(w) && !TITLE_NOISE.has(w))
    .map(stemToken)
    .filter((w) => w !== 'dev');
}

module.exports = { tokenize, titleTokens, normalizeText, stemToken };
