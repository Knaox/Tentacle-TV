/**
 * Le HDR sous Linux : ce qui SORT réellement, pas ce qu'on a demandé.
 *
 * # Pourquoi une mesure, et laquelle
 *
 * Le dépôt paie depuis le début la même leçon : une mesure qui ne mesure pas ce
 * qu'on croit coûte des journées. Sur macOS, `video-params` décrit ce que mpv
 * CALCULE, et seul le journal de la couche Metal dit ce qu'il POSE sur l'écran.
 * Sous Linux, le partage est le même — et le témoin est une propriété, ce qui
 * vaut mieux qu'un journal :
 *
 *   video-params/gamma         = bt.1886     ← ce que mpv calcule
 *   video-target-params/gamma  = pq          ← ce que l'écran reçoit
 *
 * ⚠️ **Et aucun des deux ne suffit seul.** `video-target-params` décrit la
 * SURFACE, pas le film : sur un écran en HDR permanent il vaut `pq` même pour
 * un dessin animé en bt.709, que mpv convertit alors proprement. Il faut donc
 * les deux — c'est le couple qui distingue une transmission d'un tone-mapping,
 * exactement comme le panneau F9 le disait déjà : « contenu pq → sortie srgb —
 * TONE-MAPPE ».
 *
 * Relevé le 25.08.2026 sur KWin 6.7.4, film PQ/bt.2020, écran 4K HDR :
 *
 *   video-target-params/gamma     = pq
 *   video-target-params/primaries = bt.2020
 *   video-target-params/sig-peak  = 3.813229
 *
 * et, du côté du rendu, `Picked surface configuration 7:
 * VK_FORMAT_A2B10G10R10_UNORM_PACK32 + VK_COLOR_SPACE_HDR10_ST2084_EXT`.
 *
 * # Ce que vaut `target-colorspace-hint` ici, les trois valeurs mesurées
 *
 *              contenu SDR              contenu HDR
 *   yes     sortie pq/bt.2020        sortie pq/bt.2020      ← le seul bon état
 *   auto    sortie pq/bt.2020        sortie pq/bt.2020      ← identique à `yes`
 *   no      sortie bt.1886/bt.709    sortie bt.1886/bt.709  ← TONE-MAPPÉ
 *
 * `auto` ne décide de rien sous Wayland : mpv n'y sait pas lire l'état HDR de
 * l'écran (mpv#16305) et sort du HDR quoi qu'il arrive. `no` supprime la
 * transmission, y compris pour un film qui en a besoin. D'où `yes`, posé sans
 * condition dans `mpvBaseOptions.ts` — et le contenu SDR n'y perd rien : mpv le
 * convertit vers le blanc de référence que le compositeur lui déclare.
 *
 * `sig-peak` est l'équivalent Linux du headroom EDR de macOS : le rapport entre
 * le pic de l'écran et son blanc de référence — 980 nits sur 257, soit 3,81 fois
 * le blanc SDR. C'est la plage réellement accordée, pas la capacité de la dalle.
 *
 * # Ce qu'il n'y a PAS à faire, contrairement à Windows
 *
 * Aucune bascule. Wayland alloue l'espace colorimétrique surface par surface,
 * comme macOS le fait fenêtre par fenêtre : le contenu SDR affiché à côté n'est
 * jamais remappé, il n'y a donc rien à prendre ni à rendre. `hdrSupported()`
 * reste faux sous Linux, et le réglage de bascule disparaît de lui-même.
 *
 * Sous X11, il n'y a rien du tout : X.Org n'a pas de gestion de couleur et n'en
 * aura pas. mpv y tone-mappe, et c'est la réponse honnête.
 */

import { getProperty } from "../video/mpv";

export interface Reading {
  /** Ce que le FILM est. */
  content: string | null;
  /** Ce que la SURFACE est — donc ce que l'écran reçoit. */
  output: string;
  primaries: string | null;
  /** Pic du signal rapporté à la référence — le « headroom » de Linux. */
  peak: number | null;
}

function isHdr(gamma: string | null): boolean {
  return gamma === "pq" || gamma === "hlg";
}

let last: Reading | null = null;
let inProgress = false;

/**
 * Relève ce que mpv envoie à l'écran. À appeler sur `file-loaded` ET
 * `video-reconfig`.
 *
 * ⚠️ `video-target-params/*` n'est pas renseigné à `file-loaded` : mpv a ouvert
 * le fichier mais n'a pas encore configuré sa sortie. On n'y journalise rien, et
 * le second appel tranche. Même précaution que `hdrSession.grant`.
 */
export function recordOutput(): void {
  if (inProgress) return;
  inProgress = true;
  void getProperty("video-target-params/gamma")
    .then(async (output) => {
      if (output === null || output === "") return;
      const [content, primaries, peak] = await Promise.all([
        getProperty("video-params/gamma"),
        getProperty("video-target-params/primaries"),
        getProperty("video-target-params/sig-peak"),
      ]);
      const value = peak === null ? Number.NaN : Number.parseFloat(peak);
      const reading: Reading = {
        content,
        output,
        primaries,
        peak: Number.isFinite(value) ? value : null,
      };
      if (last?.output !== reading.output || last.content !== reading.content) {
        console.info(`[hdr] ${describeReading(reading)}`);
      }
      last = reading;
    })
    .finally(() => {
      inProgress = false;
    });
}

/**
 * Le relevé en une ligne, verdict compris.
 *
 * La forme reprend celle du panneau F9 — « contenu X → sortie Y » — parce que
 * c'est le couple qui parle, et que la ligne doit se lire sans rien savoir.
 */
export function describeReading(r: Reading): string {
  const peak = r.peak === null ? "" : ` · pic ${r.peak.toFixed(2)}×`;
  const base = `contenu ${r.content ?? "?"} → sortie ${r.output}/${r.primaries ?? "?"}${peak}`;
  if (isHdr(r.content) && !isHdr(r.output)) return `${base} — TONE-MAPPÉ`;
  if (!isHdr(r.content) && isHdr(r.output)) return `${base} — SDR converti`;
  return base;
}

/**
 * L'écran reçoit-il du HDR ? `null` = mpv n'a rien dit — et surtout pas « non ».
 *
 * ⚠️ Ce n'est PAS « le film est transmis en HDR ». Sur un écran laissé en HDR,
 * un contenu SDR sort lui aussi en PQ, converti par mpv. Le verdict de
 * transmission est `transmissionHdr`, et la ligne lisible les porte tous les deux.
 */
export function outputHdr(): boolean | null {
  if (last === null) return null;
  return isHdr(last.output);
}

/**
 * Le film est-il TRANSMIS, ou aplati ?
 *
 * `null` quand la question ne se pose pas — rien de relevé, ou contenu SDR.
 * `false` est le seul cas qui doive alerter : un film HDR sorti en SDR, c'est
 * mpv qui tone-mappe parce que la transmission n'a pas pu être posée.
 */
export function hdrTransmission(): boolean | null {
  if (last === null || !isHdr(last.content)) return null;
  return isHdr(last.output);
}

/** Le relevé en une ligne lisible, ou `null` si rien n'a été relevé. */
export function outputSpace(): string | null {
  return last === null ? null : describeReading(last);
}

/** La plage accordée, en multiples du blanc de référence. */
export function outputPeak(): number | null {
  return last?.peak ?? null;
}

/** Oublie le relevé — à l'arrêt de mpv, pour ne pas décrire une lecture finie. */
export function forgetOutput(): void {
  last = null;
}
