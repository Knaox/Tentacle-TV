/**
 * Ré-émission d'un WebVTT propre, pour le lecteur web.
 *
 * Jellyfin convertit les pistes SRT/ASS en WebVTT côté serveur mais laisse
 * fuiter le balisage source dans le texte des cues — d'où le « {\an8} » qui
 * s'affiche littéralement à l'écran devant le sous-titre.
 *
 * TV et mobile n'ont jamais eu le défaut : ils passent par `parseVttCues` et
 * dessinent eux-mêmes. Le web, lui, donne le fichier tel quel à un élément
 * `<track>` et laisse le navigateur rendre — donc le balisage avec.
 *
 * Plutôt que d'écrire un moteur de rendu de sous-titres pour le web, on nettoie
 * le fichier AVANT de le donner au `<track>` : le rendu natif du navigateur est
 * conservé (style utilisateur, sous-titres en Picture-in-Picture, incrustation
 * système), et le tokenizer de tags.ts fait déjà tout le travail d'analyse.
 *
 * Ce qui est conservé : gras, italique, souligné (WebVTT les rend nativement)
 * et l'ancrage vertical, traduit en réglage de cue `line:`. Tout le reste
 * (\pos, \c&H…&, \fad, karaoké, \move…) est retiré.
 */

import { parseVttCues } from "./vtt";
import type { SubtitleAnchor, SubtitleSegment } from "./tags";

/** `HH:MM:SS.mmm` — le seul format que la spec WebVTT accepte pour > 1 h. */
function formatTimestamp(seconds: number): string {
  // Tout arrondi en millisecondes d'abord : composer h/m/s puis arrondir les ms
  // séparément peut produire « .1000 », qui invalide la cue.
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalS = (totalMs - ms) / 1000;
  const s = totalS % 60;
  const totalM = (totalS - s) / 60;
  const m = totalM % 60;
  const h = (totalM - m) / 60;
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${p2(h)}:${p2(m)}:${p2(s)}.${String(ms).padStart(3, "0")}`;
}

/** Le texte redevient du texte : sans ça, un « < » du dialogue serait relu
 *  comme une balise par l'analyseur du navigateur. `&` en PREMIER. */
function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderSegment(seg: SubtitleSegment): string {
  let rendered = escapeText(seg.text);
  if (seg.underline) rendered = `<u>${rendered}</u>`;
  if (seg.italic) rendered = `<i>${rendered}</i>`;
  if (seg.bold) rendered = `<b>${rendered}</b>`;
  return rendered;
}

/**
 * Ancrage → réglage de cue WebVTT.
 *
 * `line` est un pourcentage de hauteur depuis le haut du cadre. 10 % laisse la
 * marge que libass donne à un \an8, et 50 % centre. Le bas est le défaut du
 * navigateur : ne rien écrire vaut mieux que le figer, la position par défaut
 * tenant déjà compte des barres de contrôle et de l'incrustation système.
 */
function anchorSetting(anchor: SubtitleAnchor): string {
  if (anchor === "top") return " line:10%";
  if (anchor === "middle") return " line:50%";
  return "";
}

/**
 * Nettoie un fichier WebVTT complet.
 *
 * Renvoie `null` quand rien n'a pu être lu — fichier vide, HTML d'erreur servi
 * à la place, format inattendu. L'appelant doit alors garder l'URL d'origine :
 * un sous-titre au balisage visible reste très préférable à pas de sous-titre.
 */
export function sanitizeVtt(vtt: string): string | null {
  const cues = parseVttCues(vtt);
  if (cues.length === 0) return null;

  const blocks = cues.map((cue) => {
    const start = formatTimestamp(cue.start);
    const end = formatTimestamp(cue.end);
    const text = cue.lines.map((line) => line.map(renderSegment).join("")).join("\n");
    return `${start} --> ${end}${anchorSetting(cue.anchor)}\n${text}`;
  });

  return `WEBVTT\n\n${blocks.join("\n\n")}\n`;
}
