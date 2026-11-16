// D-109: validator struktur HTML untuk public/index.html.
// Dua bug HTML dalam dua hari (input hilang D-106, </div> dobel D-109) membuktikan
// bahwa audit id saja tidak cukup — nesting tag juga wajib diverifikasi otomatis.
// Pemakaian: node tools/check-html.js  (dipanggil dari `npm run check`).
import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'public/index.html';
const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
// Hanya tag yang relevan untuk nesting layout; tag lain (b/i/span...) dibiarkan.
const TRACKED = new Set(['div', 'section', 'main', 'aside', 'form', 'header', 'footer', 'nav', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'select', 'textarea', 'button', 'label', 'details', 'summary', 'dialog']);

const stack = []; // { tag, line, id }
const errors = [];
let line = 1;
const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
let m;
for (let pos = 0; (m = re.exec(html)); ) {
  line += html.slice(pos, m.index).split('\n').length - 1;
  pos = m.index + m[0].length;
  const closing = m[1] === '/';
  const tag = m[2].toLowerCase();
  if (!TRACKED.has(tag) || VOID.has(tag)) continue;
  const idMatch = /id="([^"]+)"/.exec(m[3]);
  const id = idMatch ? idMatch[1] : '';
  if (!closing) {
    stack.push({ tag, line, id });
  } else {
    // cari tag pembuka cocok terdekat di stack
    let idx = -1;
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) { idx = i; break; }
    if (idx === -1) { errors.push(`baris ${line}: </${tag}> tanpa pembuka`); continue; }
    for (let i = stack.length - 1; i > idx; i--) {
      errors.push(`baris ${line}: </${tag}> menutup <${stack[i].tag}${stack[i].id ? ' id="' + stack[i].id + '"' : ''} (baris ${stack[i].line}) yang belum ditutup`);
    }
    stack.length = idx;
  }
}
for (const s of stack) errors.push(`baris ${s.line}: <${s.tag}${s.id ? ' id="' + s.id + '"' : ''} tidak pernah ditutup`);

// View utama tidak boleh berada di dalam modal / pane wizard.
const modalStart = html.indexOf('id="characterModal"');
const modalEnd = html.indexOf('</form>', modalStart);
const viewRe = /<section[^>]*id="(\w*[Vv]iew\w*)"[^>]*>/g;
let v;
while ((v = viewRe.exec(html))) {
  if (v.index > modalStart && v.index < modalEnd) errors.push(`view "${v[1]}" berada DI DALAM #characterModal (struktur rusak)`);
}

if (errors.length) {
  console.error('✗ STRUKTUR HTML RUSAK (' + file + '):');
  for (const e of errors.slice(0, 12)) console.error('  - ' + e);
  if (errors.length > 12) console.error(`  … +${errors.length - 12} lain`);
  process.exit(1);
}
console.log('✓ struktur HTML valid: tag seimbang, view di luar modal (' + file + ')');
