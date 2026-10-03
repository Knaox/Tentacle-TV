// Les scénarios du banc de traces. Temps = arrivée dans le JS. tvOS : un
// appui simple n'émet que son relâchement (a=1) ; un maintien, `longX` a=0
// (~0,5 s après l'enfoncement) puis a=1 au relâcher. Android : key-down (a=0,
// répétitions comprises) puis key-up (a=1).
import type { Scenario, Step } from "./driver";

const W = (ms: number): Step => ({ wait: ms });
const K = (key: string, a?: number): Step => ({ key, a });
const tap = (key: string): Step[] => [K(key, 1)];
/** Habillage éteint : laisser passer l'extinction (5 s) après l'ouverture. */
const HIDE = W(5600);
/** Un pan tvOS : posé, glissé de `dx` pt en `ms`, par pas de 16 ms, puis levé (ou non). */
function drag(dx: number, ms: number, { lift = true, vx }: { lift?: boolean; vx?: number } = {}): Step[] {
  const steps: Step[] = [{ pan: "Began", x: 0, vx: 0 }];
  const n = Math.max(1, Math.round(ms / 16));
  const speed = vx ?? Math.abs(dx) / (ms / 1000);
  for (let i = 1; i <= n; i++) {
    steps.push(W(16));
    steps.push({ pan: "Changed", x: Math.round((dx * i) / n), vx: Math.sign(dx) * speed });
  }
  if (lift) steps.push({ pan: "Ended", x: dx, vx: 0 });
  return steps;
}
const hold = (dir: "Left" | "Right", ms: number): Step[] => [K(`long${dir}`, 0), W(ms), K(`long${dir}`, 1)];
const android = {
  tap: (key: string): Step[] => [K(key, 0), W(90), K(key, 1)],
  hold(key: "left" | "right", ms: number): Step[] {
    const long = key === "left" ? "longLeft" : "longRight";
    const steps: Step[] = [K(key, 0), W(300), K(long, 0), W(200)];
    for (let t = 500; t < ms; t += 50) steps.push(K(key, 0), W(50));
    steps.push(K(key, 1));
    return steps;
  },
};

const skip = (auto: boolean, dismissible: boolean) => ({
  kind: "skip", auto, dismissible, labelKey: "skipIntro", countdownSeconds: auto ? 8 : null,
  action: { kind: "seek", toSeconds: 1290 }, segmentType: "Intro",
}) as never;
const nextCard = (final: boolean) => ({ kind: "nextCard", final, countdownSeconds: 10 }) as never;

export const IOS: Scenario[] = [
  { id: "ios-01-saut-droite", title: "Habillage masqué : → saute de +30, badge, rien ne se rallume", steps: [HIDE, ...tap("right"), W(2000)] },
  { id: "ios-02-sauts-cumules", title: "Deux → à 0,9 s : +30 puis +30 depuis la cible, badge +60", steps: [HIDE, ...tap("right"), W(900), ...tap("right"), W(2000)] },
  { id: "ios-03-saut-gauche-puis-droite", title: "← −10 puis → : le badge repart de +30", steps: [HIDE, ...tap("left"), W(700), ...tap("right"), W(2000)] },
  { id: "ios-04-saut-en-pause", title: "Pause, habillage masqué par Retour : → saute, la pause reste", steps: [...tap("playPause"), W(300), { menu: true }, W(300), ...tap("right"), W(2000)] },
  { id: "ios-05-maintien-lecture", title: "Maintien → 2,5 s en lecture : défilement, paliers, décompte, reprise à la cible", steps: [HIDE, ...hold("Right", 2500), W(6500)] },
  { id: "ios-06-maintien-pause", title: "Maintien → en pause (désépinglée) : pas de décompte, OK valide", steps: [...tap("playPause"), W(300), { menu: true }, W(300), ...hold("Right", 1500), W(8000), ...tap("select"), W(1000)] },
  { id: "ios-07-retour-annule-grace", title: "Défilement puis Menu : annulé, grâce 600 ms, puis habillage masqué, puis sortie", steps: [HIDE, ...hold("Left", 1200), W(1000), { menu: true }, W(300), { menu: true }, W(500), { menu: true }, W(300), { menu: true }, W(500)] },
  { id: "ios-08-appuis-en-defilement", title: "En défilement : appui ignoré 400 ms après le maintien, puis ±30/−10, décompte relancé", steps: [HIDE, ...hold("Right", 1100), W(200), ...tap("right"), W(500), ...tap("right"), W(600), ...tap("left"), W(6000)] },
  { id: "ios-09-habillage-fleches", title: "Habillage affiché : ←/→/↑/↓ ne sautent pas, relancent l'extinction", steps: [W(2000), ...tap("right"), W(3000), ...tap("left"), W(3000), ...tap("up"), W(4000), ...tap("down"), W(6000)] },
  { id: "ios-10-ok-fond", title: "Habillage masqué : OK rallume ; habillage affiché : OK n'agit pas", steps: [HIDE, ...tap("select"), W(2000), ...tap("select"), W(6000)] },
  { id: "ios-11-lecture-pause", title: "▶︎❙❙ : pause épinglée (pas d'extinction), puis lecture et extinction 5 s", steps: [HIDE, ...tap("playPause"), W(7000), ...tap("playPause"), W(6000)] },
  { id: "ios-12-menu-couches", title: "Menu : habillage masqué (lecture continue), puis sortie", steps: [W(1000), { menu: true }, W(1000), { menu: true }, W(500)] },
  { id: "ios-13-menu-pause", title: "Pause : Menu désépingle, OK réépingle, Menu, Menu sort", steps: [...tap("playPause"), W(500), { menu: true }, W(500), ...tap("select"), W(500), { menu: true }, W(500), { menu: true }, W(500)] },
  { id: "ios-14-boutons-saut", title: "Boutons +30 / −10 de l'habillage : sauts instantanés et badge", steps: [W(500), { button: "onSeekForward" }, W(400), { button: "onSeekForward" }, W(400), { button: "onSeekBack" }, W(3000)] },
  { id: "ios-15-bouton-avance", title: "Bouton ⏩ : défilement sans bouger, jumeau absorbé, OK valide, boutons avalés 400 ms", steps: [W(500), { button: "onScrub" }, W(1500), ...tap("right"), W(500), ...tap("select"), W(100), { button: "onPlayPause", twin: "none" }, W(600), { button: "onPlayPause", twin: "none" }, W(1000)] },
  { id: "ios-16-bouton-avance-pause", title: "Bouton ⏩ en pause : aucune reprise seule ; Menu annule", steps: [...tap("playPause"), W(500), { button: "onScrub" }, W(9000), { menu: true }, W(1500)] },
  { id: "ios-17-bouton-avance-decompte", title: "Bouton ⏩ en lecture sans geste : reprise à l'origine sans seek", steps: [W(500), { button: "onScrub" }, W(7000)] },
  { id: "ios-18-pave-masque-lent", title: "Pavé, habillage masqué : engage après 600 ms, la cible suit, décompte au lever", steps: [HIDE, ...drag(400, 1600), W(7000)] },
  { id: "ios-19-pave-masque-frole", title: "Pavé, habillage masqué : frôlement de 300 ms, rien ne défile, l'habillage se réveille", steps: [HIDE, ...drag(200, 300), W(1000)] },
  { id: "ios-20-pave-affiche", title: "Pavé, habillage affiché : engage à 180 ms ; geste vif ≥ 180 pt", steps: [W(500), ...drag(300, 600), W(1200), { menu: true }, W(800), ...tap("select"), W(300), ...drag(500, 120, { vx: 9000 }), W(7000)] },
  { id: "ios-21-pave-silence", title: "Pavé sans fin (annulé par tvOS) : 450 ms de silence closent le geste", steps: [HIDE, ...drag(500, 1000, { lift: false }), W(7000)] },
  { id: "ios-22-pave-ouvert", title: "Défilement ouvert : le doigt reprend dès 12 pt, tient le décompte", steps: [HIDE, ...hold("Right", 1100), W(1500), ...drag(-60, 400, { lift: false }), W(2000), { pan: "Ended", x: -60 }, W(7000)] },
  { id: "ios-23-toucher-apres-appui", title: "Toucher qui accompagne un clic (≤ 600 ms) : aucun réveil", steps: [HIDE, ...tap("right"), W(200), ...drag(20, 100), W(2000), ...drag(20, 100), W(2000)] },
  { id: "ios-24-releve-relance", title: "Constat : ↑ relâché pendant le défilement relance le décompte", steps: [HIDE, ...hold("Right", 1100), W(3000), ...tap("up"), W(3000), ...tap("down"), W(7000)] },
  { id: "ios-25-episodes", title: "Panneau Épisodes : contrôles neutralisés, pan rendu, Menu ferme", env: { showEpisodes: true }, steps: [W(500), ...tap("right"), W(300), ...tap("select"), W(300), ...tap("playPause"), W(300), ...hold("Right", 1200), W(500), { menu: true }, W(6000)] },
  { id: "ios-26-feuille", title: "Feuille Pistes : contrôles neutralisés, Menu ferme", env: { showSettings: true }, steps: [W(500), ...tap("left"), W(300), ...tap("playPause"), W(300), { menu: true }, W(6000)] },
  { id: "ios-27-carte-a-suivre", title: "Constat : carte « À suivre » hors panelOpen ; Menu la refuse + grâce", env: { overlay: nextCard(false) }, steps: [HIDE, ...tap("right"), W(5600), ...hold("Right", 1200), W(500), { menu: true }, W(300), { menu: true }, W(400), { menu: true }, W(300), { menu: true }, W(700), { menu: true }, W(1000)] },
  { id: "ios-28-fin", title: "Affiche de fin : contrôles neutralisés ; Menu la refuse (sortie, sans grâce)", env: { overlay: nextCard(true), ended: true }, steps: [W(500), ...tap("right"), W(300), ...tap("playPause"), W(300), ...hold("Left", 1200), W(300), { menu: true }, W(1000)] },
  { id: "ios-29-pilule-auto", title: "Pilule automatique refusable : Menu la met en sourdine + grâce", env: { overlay: skip(true, true) }, steps: [HIDE, ...tap("right"), W(500), { menu: true }, W(300), { menu: true }, W(400), { menu: true }, W(500)] },
  { id: "ios-31-bouton-en-defilement", title: "Défilement ouvert : le bouton +30 (gardé) VALIDE au lieu de sauter", steps: [W(500), { button: "onScrub" }, W(800), ...tap("right"), W(500), { button: "onSeekForward", twin: "none" }, W(1500)] },
  { id: "ios-32-maintien-habillage-pause", title: "Pause épinglée : maintien → ne défile pas (habillage affiché) ; Retour masque, puis maintien défile", steps: [...tap("playPause"), W(500), ...hold("Right", 1200), W(500), { menu: true }, W(500), ...hold("Right", 1200), W(2000), { menu: true }, W(1500)] },
  { id: "ios-33-select-pendant-maintien", title: "OK pendant un maintien (défilement) : valide et coupe le tic", steps: [HIDE, K("longRight", 0), W(1300), ...tap("select"), W(400), K("longRight", 1), W(2000)] },
  { id: "ios-30-ouverture", title: "Constat : écran d'ouverture, contrôles vivants (▶︎❙❙, glisser)", env: { opening: true }, steps: [W(500), ...tap("playPause"), W(300), ...drag(400, 600), W(2000), { menu: true }, W(500)] },
];

export const ANDROID: Scenario[] = [
  { id: "and-01-saut", title: "Android : appui → (down/up) habillage masqué : saut au key-up", steps: [HIDE, ...android.tap("right"), W(2000)] },
  { id: "and-02-maintien", title: "Android : maintien → 2,5 s (répétitions) : défilement", steps: [HIDE, ...android.hold("right", 2500), W(7000)] },
  { id: "and-03-media", title: "Android : touches média ⏩ isolée puis répétée", steps: [HIDE, K("fastForward", 0), W(80), K("fastForward", 1), W(1000), K("fastForward", 0), W(100), K("fastForward", 0), W(100), K("fastForward", 0), W(100), K("fastForward", 0), W(80), K("fastForward", 1), W(400), K("select", 0), W(80), K("select", 1), W(1000)] },
  { id: "and-04-retour", title: "Android : Retour en défilement annule ; Retour habillage → sortie", steps: [HIDE, ...android.hold("left", 1500), W(500), { androidBack: true }, W(800), { androidBack: true }, W(500)] },
  { id: "and-05-habillage", title: "Android : habillage affiché, ←/→ ne sautent pas", steps: [W(500), ...android.tap("right"), W(500), ...android.tap("left"), W(6000)] },
  { id: "and-06-badge", title: "Android : badge cumulé (+30, +60), ← le fait repartir, effacement 1,5 s", steps: [HIDE, ...android.tap("right"), W(700), ...android.tap("right"), W(700), ...android.tap("left"), W(2500)] },
  { id: "and-07-boutons", title: "Android : boutons +30 / ⏩ (jumeau select absorbé), OK valide, boutons avalés 400 ms", steps: [W(500), { button: "onSeekForward" }, W(600), { button: "onScrub" }, W(1200), ...android.tap("right"), W(500), ...android.tap("select"), W(100), { button: "onPlayPause", twin: "none" }, W(600), { button: "onPlayPause", twin: "none" }, W(1500)] },
  { id: "and-08-lecture-pause", title: "Android : ▶︎❙❙ bascule et épingle ; en défilement il valide", steps: [HIDE, ...android.tap("playPause"), W(1500), ...android.tap("playPause"), W(6000), K("fastForward", 0), W(80), K("fastForward", 1), W(1500), ...android.tap("playPause"), W(1500)] },
  { id: "and-09-maintien-sans-long", title: "Android : maintien déduit du key-down (pas de longRight, pas de répétition)", steps: [HIDE, K("right", 0), W(1500), K("right", 1), W(6500)] },
  { id: "and-10-recul-media", title: "Android : ⏪ isolé ouvre le défilement −10 ; Retour annule, grâce", steps: [HIDE, K("rewind", 0), W(80), K("rewind", 1), W(1000), { androidBack: true }, W(300), { androidBack: true }, W(700), { androidBack: true }, W(500)] },
  { id: "and-11-pilule-retour", title: "Android : Retour sur une pilule automatique : sourdine + grâce", env: { overlay: skip(true, true) }, steps: [HIDE, { androidBack: true }, W(300), { androidBack: true }, W(800), { androidBack: true }, W(500)] },
  { id: "and-12-carte-retour", title: "Android : carte « À suivre » : Retour la refuse ; fin : Retour la refuse sans grâce", env: { overlay: nextCard(false) }, steps: [W(500), { androidBack: true }, W(300), { androidBack: true }, W(800), { patch: { overlay: nextCard(true), ended: true } }, W(300), { androidBack: true }, W(500)] },
  { id: "and-13-reglages", title: "Android : réglages ouverts : flèches neutralisées, Retour les ferme", env: { showSettings: true }, steps: [W(500), ...android.tap("right"), W(300), ...android.tap("playPause"), W(300), { androidBack: true }, W(600), { androidBack: true }, W(500)] },
  { id: "and-14-episodes", title: "Android : épisodes ouverts : maintien et média neutralisés, Retour les ferme", env: { showEpisodes: true }, steps: [W(500), ...android.hold("right", 1200), W(300), K("fastForward", 0), W(80), K("fastForward", 1), W(300), { androidBack: true }, W(6000)] },
  { id: "and-15-pan-ignore", title: "Android : aucun pavé (le pan n'est pas tenu)", steps: [HIDE, ...drag(400, 600), W(1000)] },
  { id: "and-16-haut-bas", title: "Android : ↑/↓ rallument l'habillage ; en défilement ils ne font que relancer le décompte", steps: [HIDE, ...android.tap("up"), W(5600), K("fastForward", 0), W(80), K("fastForward", 1), W(3000), ...android.tap("down"), W(3000), ...android.tap("up"), W(6000)] },
];
