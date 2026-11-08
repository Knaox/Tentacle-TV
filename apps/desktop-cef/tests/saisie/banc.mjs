#!/usr/bin/env node
// Banc de la saisie : touches natives (NSEvent postés) contre ce que Chromium standard (donc
// Electron) livre à la page. Attendus : tables de Chromium Mac (ui/events/keycodes/dom,
// KeyboardCodeFromNSEvent ; keypress seulement pour un caractère, Entrée comprise).
// Usage : node tests/saisie/banc.mjs <port> [cas…]   (lancé par scripts/banc-saisie.sh)
import { connect, sleep, K, P, keyboard, fmt } from './lib.mjs';
import { menuCases } from './menus.mjs';

const port = process.argv[2] || '9314';
const only = process.argv.slice(3);
const cdp = await connect(port);
const { js } = cdp;
const { native, press } = keyboard(js);
const keyFor = async (ch) => JSON.parse(await native({ type: 'app', action: 'keyFor', char: ch }));
const MODS = new Set(['Meta', 'Shift', 'Alt', 'Control', 'CapsLock']);

const results = [];
const report = (name, ok, got, want) => {
  results.push({ name, ok, got, want });
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${name} — ${got}${ok ? '' : `  (attendu : ${want})`}`);
};
// Prépare un champ (valeur, curseur), vide le journal de la page.
const prep = (id, value = '', caret = value.length) => js(`(()=>{__ev.length=0;__submits=0;__block=null;` +
  (id ? `const e=document.getElementById('${id}');e.value=${JSON.stringify(value)};e.focus();e.setSelectionRange(${caret},${caret});` : `document.activeElement?.blur();`) + `return 1})()`);
const keyEvents = async () => (await js('__ev.slice()')).filter((e) => !MODS.has(e.key)).map(fmt);
const field = (id) => js(`(()=>{const e=document.getElementById('${id}');return {v:e.value,s:e.selectionStart,e:e.selectionEnd,focus:document.activeElement?.id||''}})()`);
const down = (key, code, kc, m = '') => `keydown ${JSON.stringify(key)}/${code}/${kc}${m}`;
const up = (key, code, kc, m = '') => `keyup ${JSON.stringify(key)}/${code}/${kc}${m}`;
const kp = (key, code, ch, m = '') => `keypress ${JSON.stringify(key)}/${code}/${ch}/c${ch}${m}`;
const tap = (key, code, kc, m = '') => [down(key, code, kc, m), up(key, code, kc, m)];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Cas : [nom, préparation, gestes, évènements attendus, contrôle d'effet facultatif]
const cases = [
  ['Entrée (champ de formulaire)', () => prep('a', 'x'), () => press(K.return),
    [down('Enter', 'Enter', 13), kp('Enter', 'Enter', 13), up('Enter', 'Enter', 13)],
    async () => ['envoi', await js('__submits'), 1]],
  ['Entrée du pavé numérique', () => prep('a', 'x'), () => press(K.kpEnter),
    [down('Enter', 'NumpadEnter', 13), kp('Enter', 'NumpadEnter', 13), up('Enter', 'NumpadEnter', 13)],
    async () => ['envoi', await js('__submits'), 1]],
  ['Tab', () => prep('a'), () => press(K.tab), tap('Tab', 'Tab', 9),
    async () => ['focus', (await field('a')).focus, 'b']],
  ['Maj+Tab', () => prep('b'), () => press(K.tab, ['shift'], { chars: '\x19' }), tap('Tab', 'Tab', 9, '+shift'),
    async () => ['focus', (await field('a')).focus, 'a']],
  ['Échap', () => prep('a'), () => press(K.esc), tap('Escape', 'Escape', 27)],
  ['Flèches', () => prep('a', 'abc'), async () => { for (const k of ['left', 'right', 'up', 'down']) await press(K[k]); },
    [...tap('ArrowLeft', 'ArrowLeft', 37), ...tap('ArrowRight', 'ArrowRight', 39), ...tap('ArrowUp', 'ArrowUp', 38), ...tap('ArrowDown', 'ArrowDown', 40)]],
  ['Flèche gauche déplace le curseur', () => prep('a', 'abc'), () => press(K.left), tap('ArrowLeft', 'ArrowLeft', 37),
    async () => ['curseur', (await field('a')).s, 2]],
  ['Espace', () => prep('a'), () => press(K.space), [down(' ', 'Space', 32), kp(' ', 'Space', 32), up(' ', 'Space', 32)],
    async () => ['valeur', (await field('a')).v, ' ']],
  ['Retour arrière', () => prep('a', 'abc'), () => press(K.backspace), tap('Backspace', 'Backspace', 8),
    async () => ['valeur', (await field('a')).v, 'ab']],
  ['Suppr (fn+⌫)', () => prep('a', 'abc', 0), () => press(K.del), tap('Delete', 'Delete', 46),
    async () => ['valeur', (await field('a')).v, 'bc']],
  ['Début/Fin/PgPréc/PgSuiv', () => prep(null), async () => { for (const k of ['home', 'end', 'pgup', 'pgdn']) await press(K[k]); },
    [...tap('Home', 'Home', 36), ...tap('End', 'End', 35), ...tap('PageUp', 'PageUp', 33), ...tap('PageDown', 'PageDown', 34)]],
  ['F (plein écran du lecteur)', () => prep(null), () => press(P.f), [down('f', 'KeyF', 70), kp('f', 'KeyF', 102), up('f', 'KeyF', 70)]],
  ['F1 à F10, F12', () => prep(null), async () => { for (const k of ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f12']) await press(K[k]); },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].flatMap((n) => tap(`F${n}`, `F${n}`, 111 + n))],
  ['Maj seule (modificateur)', () => prep('a'), async () => { await native({ type: 'flags', keyCode: 0x38, mods: ['shift'] }); await native({ type: 'flags', keyCode: 0x38, mods: [] }); await sleep(120); },
    null, async () => ['évènements Maj', (await js('__ev.slice()')).map(fmt).join(' | '), `${down('Shift', 'ShiftLeft', 16, '+shift')} | ${up('Shift', 'ShiftLeft', 16)}`]],
  ['Répétition (a maintenu)', () => prep('a'), () => press(P.a, [], { repeats: 2 }),
    [down('a', 'KeyA', 65), kp('a', 'KeyA', 97), down('a', 'KeyA', 65, ' R'), kp('a', 'KeyA', 97, ' R'), down('a', 'KeyA', 65, ' R'), kp('a', 'KeyA', 97, ' R'), up('a', 'KeyA', 65)],
    async () => ['valeur', (await field('a')).v, 'aaa']],
  ['Disposition active : touche Z ANSI', () => prep('a'), () => press(P.z), null,
    async () => ['valeur / keydown', `${(await field('a')).v} ${(await keyEvents())[0]}`, null]],
  ['Option+G (@ en suisse romand)', () => prep('a'), () => press(0x05, ['alt']), null,
    async () => ['valeur', (await field('a')).v, '@']],
  ['Option+← / Option+→ (mot)', () => prep('a', 'un deux trois'), async () => { await press(K.left, ['alt']); },
    null, async () => ['curseur', (await field('a')).s, 8]],
  ['Cmd+← / Cmd+→ (ligne)', () => prep('a', 'un deux trois'), async () => { await press(K.left, ['cmd']); },
    null, async () => ['curseur', (await field('a')).s, 0]],
  ['Cmd+→ (fin de ligne)', () => prep('a', 'un deux trois', 0), async () => { await press(K.right, ['cmd']); },
    null, async () => ['curseur', (await field('a')).s, 13]],
  ['Maj+Option+← (sélection d\'un mot)', () => prep('a', 'un deux trois'), () => press(K.left, ['shift', 'alt']),
    null, async () => { const f = await field('a'); return ['sélection', `${f.s}-${f.e}`, '8-13']; }],
  ['Option+⌫ (efface un mot)', () => prep('a', 'un deux trois'), () => press(K.backspace, ['alt']),
    null, async () => ['valeur', (await field('a')).v, 'un deux ']],
  ['Maj+Cmd+← (sélection jusqu\'au début)', () => prep('a', 'un deux trois'), () => press(K.left, ['shift', 'cmd']),
    null, async () => { const f = await field('a'); return ['sélection', `${f.s}-${f.e}`, '0-13']; }],
  ['Cmd+⌫ (efface jusqu\'au début)', () => prep('a', 'un deux trois'), () => press(K.backspace, ['cmd']),
    null, async () => ['valeur', (await field('a')).v, '']],
  ['Cmd+A puis Cmd+C, Cmd+V', () => prep('a', 'bonjour'), async () => { await press(P.a, ['cmd']); await press(P.c, ['cmd']); await press(K.right); await press(P.v, ['cmd'], { wait: 300 }); },
    null, async () => ['valeur', (await field('a')).v, 'bonjourbonjour']],
  ['Cmd+Z puis Maj+Cmd+Z', () => prep('a', ''), async () => { const z = await keyFor('z'); await press(P.s); await press(P.a); await press(z, ['cmd'], { wait: 250 }); const mid = (await field('a')).v; await press(z, ['cmd', 'shift'], { wait: 250 }); await js(`__mid=${JSON.stringify(mid)}`); },
    null, async () => ['après annuler / rétablir', `${await js('__mid')} / ${(await field('a')).v}`, ' / sa']],
  ['Cmd+X', () => prep('a', 'coupe'), async () => { await press(P.a, ['cmd']); await press(P.x, ['cmd'], { wait: 250 }); },
    null, async () => ['valeur', (await field('a')).v, '']],
  ['Cmd+K vu par la page (raccourci)', () => prep(null), () => press(P.k, ['cmd']), null,
    async () => ['keydown', (await keyEvents()).find((e) => e.startsWith('keydown')), down('k', 'KeyK', 75, '+meta')]],
  ['Touche morte ^ puis e', () => prep('a'), async () => { await press([0x18, ''], [], { charsIgnoring: '^' }); await press([P.e, 'ê'], [], { charsIgnoring: 'e' }); },
    null, async () => ['valeur', (await field('a')).v, 'ê']],
  ['IME (composition puis validation)', () => prep('a'), async () => { await native({ type: 'ime', marked: 'にほ' }); await native({ type: 'ime', marked: 'にほん' }); await native({ type: 'ime', insert: '日本' }); await sleep(200); },
    null, async () => ['valeur', (await field('a')).v, '日本']],
  ['Entrée pendant une composition IME n\'envoie pas', () => prep('a'), async () => { await native({ type: 'ime', marked: 'にほ' }); await sleep(100); await press(K.return); await native({ type: 'ime', insert: 'にほ' }); await sleep(200); },
    null, async () => ['envois', await js('__submits'), 0]],
  ...menuCases({ js, native, press, prep, keyEvents, report }),
];

for (const [name, setup, act, want, effect] of cases) {
  if (only.length && !only.some((o) => name.toLowerCase().includes(o.toLowerCase()))) continue;
  await setup();
  await sleep(80);
  await act();
  const got = await keyEvents();
  let ok = true, detail = '';
  if (want) {
    ok = same(got, want);
    detail = got.join(' | ');
    if (!ok) { report(name + ' — évènements', false, detail, want.join(' | ')); }
  }
  if (effect) {
    const [what, value, expected] = await effect();
    const eok = expected === null || same(value, expected);
    report(name, ok && eok, `${what} = ${JSON.stringify(value)}${(want && ok) || !eok ? ` ; ${got.join(' | ')}` : ''}`, `${what} = ${JSON.stringify(expected)}`);
  } else if (ok) {
    report(name, true, detail, '');
  }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} OK`);
cdp.close();
process.exit(failed.length ? 1 : 0);
