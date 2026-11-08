// Raccourcis de fenêtre et d'application, comparés au bureau Electron 1.42.0 sur macOS
// (Tentacle-TV apps/desktop-electron/src/main/menu.ts, fullscreenSync.ts, ipc/mediaKeys.ts) :
//   menu Application (Masquer ⌘H, Masquer les autres ⌥⌘H, Quitter ⌘Q), Édition (rôle editMenu),
//   Fenêtre (rôle windowMenu : Réduire ⌘M, Zoom, Plein écran ⌃⌘F ajouté par macOS) ;
//   F11 bascule le plein écran AVANT la page ; pas de ⌘W, ⌘, ni ⌘± (aucun menu Affichage) ;
//   touches média : sans effet sur macOS (useSmtc n'est actif que sous Windows).
import { sleep, K, P } from './lib.mjs';

export function menuCases({ js, native, press, prep, keyEvents }) {
  const app = async (action) => JSON.parse(await native({ type: 'app', action }));
  const until = async (pred, ms = 3000) => {
    for (let t = 0; t < ms; t += 100) { const s = await app('state'); if (pred(s)) return s; await sleep(100); }
    return app('state');
  };
  const sawKey = async (k) => (await keyEvents()).some((e) => e.startsWith(`keydown ${JSON.stringify(k)}`));
  const dpr = () => js('devicePixelRatio');
  return [
    ['⌘W ne ferme pas (Electron : pas d\'élément Fermer)', () => prep(null), async () => { await press(P.w, ['cmd'], { wait: 400 }); },
      null, async () => { const s = await app('state'); return ['fenêtre visible / keydown vu', `${s.visible} / ${await sawKey('w')}`, 'true / true']; }],
    ['⌘, sans effet (Electron : pas de Réglages)', () => prep(null), () => press(P.comma, ['cmd']),
      null, async () => ['keydown vu', await sawKey(','), true]],
    ['⌘+ / ⌘- / ⌘0 sans zoom (Electron : pas de menu Affichage)', () => prep(null), async () => {
      await js(`__dpr=devicePixelRatio`); await press(P.bracketR, ['cmd']); await press(P.minus, ['cmd']); await press(P.n0, ['cmd'], { wait: 300 }); },
    null, async () => ['devicePixelRatio inchangé', (await dpr()) === (await js('__dpr')), true]],
    ['⌘M réduit la fenêtre', () => prep(null), async () => { await press(P.m, ['cmd']); },
      null, async () => { const s = await until((x) => x.miniaturized); await app('deminiaturize'); await until((x) => !x.miniaturized); return ['réduite', s.miniaturized, true]; }],
    ['⌘H masque l\'app', () => prep(null), async () => { await press(P.h, ['cmd']); },
      null, async () => { const s = await until((x) => x.hidden); await app('unhide'); await until((x) => !x.hidden); return ['masquée', s.hidden, true]; }],
    ['⌃⌘F bascule le plein écran', () => prep(null), async () => { await press(P.f, ['ctrl', 'cmd']); },
      null, async () => { const on = await until((x) => x.fullscreen, 4000); await sleep(800); await press(P.f, ['ctrl', 'cmd']); const off = await until((x) => !x.fullscreen, 4000); await sleep(800); return ['plein écran puis fenêtré', `${on.fullscreen} / ${off.fullscreen}`, 'true / false']; }],
    ['F11 bascule le plein écran, la page ne la voit pas', () => prep(null), async () => { await press(K.f11); },
      null, async () => { const on = await until((x) => x.fullscreen, 4000); await sleep(800); const seen = await sawKey('F11'); await press(K.f11); const off = await until((x) => !x.fullscreen, 4000); await sleep(800); return ['plein écran / fenêtré / F11 vue', `${on.fullscreen} / ${off.fullscreen} / ${seen}`, 'true / false / false']; }],
    ['Touche média lecture/pause : sans effet, rien dans la page (comme Electron)', () => prep(null), async () => { await native({ type: 'media', key: 16 }); await sleep(300); },
      null, async () => ['évènements page', (await keyEvents()).length, 0]],
  ];
}
