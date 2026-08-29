/**
 * Ce que le serveur fait vraiment de l'image, affiché sur la dalle.
 *
 * **Jamais en production.** L'installation est gardée par
 * `import.meta.env.DEV || __TV_DEBUG__` et l'import y est dynamique : ce module
 * et tout ce qu'il tire disparaissent du fragment servi à un téléviseur. Le même
 * motif que `debugOverlay.ts`, pour la même raison.
 *
 * # Pourquoi elle existe
 *
 * Un transcodage réussi ressemble à une lecture directe : même image, même son,
 * en plus lent et en moins beau. Rien à l'écran ne distingue un REMUX — le
 * serveur démultiplexe, l'image est copiée telle quelle — d'un RÉ-ENCODAGE, où
 * elle est recompressée en permanence. Jusqu'ici il fallait ouvrir un inspecteur
 * distant et lire un `console.warn` pour le savoir, ce qui revient à ne jamais
 * le savoir.
 *
 * Le verdict lui-même vient de `playbackVerdict.ts`, côté web : il est déjà
 * calculé et déjà testé. Ce fichier ne fait que le peindre.
 *
 * # Quand elle se montre
 *
 * `debugOverlay` s'ouvre par Ctrl+Maj+D, ce qui suppose un clavier — la
 * télécommande n'a pas de modificateur. Celle-ci se montre donc d'elle-même,
 * mais **seulement quand les commandes sont à l'écran** : un panneau posé sur
 * une image qu'on regarde n'est plus un instrument, c'est une gêne. Les
 * commandes se masquent d'elles-mêmes après cinq secondes, et le panneau avec.
 *
 * Écrite sans React, comme sa voisine : elle survit à un arbre cassé, et surtout
 * elle ne pose **aucun élément focusable** — le moteur de focus compte les
 * cibles atteignables, une surcouche qui s'y ajouterait fausserait la
 * navigation qu'elle est censée aider à observer.
 */

const ID = "tv-lecture";
const PERIOD_MS = 500;

/** Ce que `playbackInfoTv` dépose à chaque négociation. Voir `publishPlayback`. */
export interface PlaybackReport {
  mode: string;
  videoReencoded: boolean;
  reasons: string[];
  /** Codec de la piste vidéo source, tel que Jellyfin le nomme. */
  videoCodec?: string;
  /** Plage dynamique de la source — la valeur brute du serveur. */
  range?: string | number;
  /** L'URL réellement servie au lecteur : c'est elle qui trahit le sort de l'audio. */
  url?: string | null;
}

declare global {
  interface Window {
    __TENTACLE_PLAYBACK__?: PlaybackReport | null;
  }
}

/**
 * Dépose un relevé pour la surcouche.
 *
 * Passe par une globale plutôt que par un import : l'appelant
 * (`playback/playbackInfoTv.ts`) est du code de production, et ne doit pas tirer
 * ce module dans le bundle. Sa propre garde `import.meta.env.DEV` élimine
 * l'appel, et cette fonction avec.
 */
export function publishPlayback(report: PlaybackReport | null): void {
  if (typeof window === "undefined") return;
  window.__TENTACLE_PLAYBACK__ = report;
}

/**
 * Le sort de l'audio, lu dans l'URL servie.
 *
 * `AudioCodec=copy` est ce que Jellyfin écrit quand il se contente de recopier
 * la piste. Toute autre valeur est une conversion — la chose même qu'on cherche
 * à faire disparaître, et qui ne se voit ni ne s'entend franchement.
 */
function audioFate(url?: string | null): [string, boolean | null] {
  if (!url) return ["—", null];
  if (!url.includes(".m3u8")) return ["source", true];
  const codec = /[?&]AudioCodec=([^&]*)/i.exec(url)?.[1];
  if (!codec) return ["?", null];
  return codec.toLowerCase() === "copy" ? ["copié", true] : [`converti → ${codec}`, false];
}

/** La variante Dolby Vision est-elle celle qui joue ? */
function videoFate(report: PlaybackReport): [string, boolean] {
  if (report.videoReencoded) return ["RECOMPRESSÉE", false];
  return [report.mode === "DirectPlay" ? "fichier d'origine" : "copiée", true];
}

function line(key: string, value: string, good: boolean | null): string {
  const color = good === null ? "#d4d4d8" : good ? "#34d399" : "#fb7185";
  return (
    `<div style="display:flex;gap:12px;justify-content:space-between">` +
    `<span style="color:#a1a1aa">${key}</span>` +
    `<span style="color:${color};font-weight:600">${value}</span></div>`
  );
}

function draw(report: PlaybackReport | null): void {
  const existing = document.getElementById(ID);
  if (!report) {
    existing?.remove();
    return;
  }

  const root = existing ?? document.createElement("div");
  if (!existing) {
    root.id = ID;
    root.setAttribute("aria-hidden", "true");
    // Fond OPAQUE : posé sur une image claire, un panneau translucide devient
    // illisible au moment précis où l'on cherche à y lire une valeur.
    root.style.cssText = [
      "position:fixed",
      "left:24px",
      "top:24px",
      "z-index:2147483646",
      "pointer-events:none",
      "background:#0a0a10",
      "border:1px solid #27272a",
      "border-radius:8px",
      "padding:10px 14px",
      "font:600 15px/1.55 ui-monospace,Menlo,monospace",
      "min-width:340px",
      "opacity:0.94",
    ].join(";");
    document.body.appendChild(root);
  }

  const [image, imageOk] = videoFate(report);
  const [audio, audioOk] = audioFate(report.url);
  const reasons = report.reasons.length ? report.reasons.join(", ") : "aucune";

  root.innerHTML =
    `<div style="color:#71717a;font-size:12px;letter-spacing:.08em;margin-bottom:6px">LECTURE — DEV</div>` +
    line("mode", report.mode, !report.videoReencoded) +
    line("image", image, imageOk) +
    line("audio", audio, audioOk) +
    line("codec", String(report.videoCodec ?? "?"), null) +
    line("plage", String(report.range ?? "?"), null) +
    line("raisons", reasons, report.reasons.length === 0);
}

/**
 * Le panneau ne s'affiche qu'avec les commandes, jamais par-dessus le film.
 *
 * `playerCycleTv` pose `data-tv-lecteur` sur la racine du document — `repos`,
 * `osd` ou `scrub` — précisément parce qu'un état du lecteur n'est atteignable
 * autrement ni par le CSS, ni par un module hors React. Les feuilles de style
 * s'en servent déjà ; on s'y branche plutôt que d'inventer une seconde source.
 *
 * `osd` et non « pas repos » : le déplacement dans le flux occupe déjà tout
 * l'écran, un panneau de plus par-dessus n'y aiderait personne.
 */
function osdVisible(): boolean {
  return document.documentElement.getAttribute("data-tv-lecteur") === "osd";
}

/**
 * Installe la surveillance. Rend de quoi la retirer.
 *
 * Un intervalle pour le CONTENU du relevé, déposé depuis un hook React — un
 * pont d'événements entre les deux coûterait plus cher à lire qu'un sondage à
 * deux images par seconde qui ne tourne qu'en développement. Mais un
 * `MutationObserver` pour la VISIBILITÉ : une demi-seconde de retard à chaque
 * apparition des commandes se verrait, là où l'attribut change à l'instant près.
 */
export function installPlaybackOverlay(): () => void {
  let last: string | null = null;

  const paint = () => {
    // La visibilité est pliée dans la valeur, et ce n'est pas un détail : un
    // retour anticipé qui laisserait `last` intact empêcherait le panneau de
    // se redessiner au retour des commandes — l'empreinte n'aurait pas bougé.
    const effective = osdVisible() ? (window.__TENTACLE_PLAYBACK__ ?? null) : null;
    const fingerprint = effective ? JSON.stringify(effective) : null;
    if (fingerprint === last) return;
    last = fingerprint;
    draw(effective);
  };

  const timer = window.setInterval(paint, PERIOD_MS);
  const watcher = new MutationObserver(paint);
  watcher.observe(document.documentElement, { attributeFilter: ["data-tv-lecteur"] });

  return () => {
    watcher.disconnect();
    window.clearInterval(timer);
    document.getElementById(ID)?.remove();
  };
}
