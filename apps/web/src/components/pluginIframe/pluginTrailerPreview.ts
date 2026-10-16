import { getTrailerPreviewBlock, subscribeTrailerPreviewBlock } from "../../trailerPreview/previewEnvironment";
import { trailerPreviewDelayChoice, trailerPreviewMutedFlag, trailerPreviewVolumeLevel } from "../../trailerPreview/previewSettings";

/**
 * Les aperçus de bande-annonce, vus d'une EXTENSION : ce que son iframe ne
 * peut pas lire seule (sandbox, `localStorage` simulé) et qu'elle doit
 * respecter comme les cartes du cœur.
 *
 *   - `enabled` : rien n'interdit un aperçu sur CET appareil en ce moment
 *     (`getTrailerPreviewBlock()` : réglage « Aperçus au survol », hors
 *     ligne, miroir, page cachée, pas de souris, économie de données) ;
 *   - `muted` : le son des aperçus coupé d'un geste, retenu sur l'appareil ;
 *   - `volume` : le volume des aperçus (0 à 1), retenu sur l'appareil
 *     (additif : un hôte d'avant ne le donne pas) ;
 *   - `delayMs` : le délai choisi entre le début du survol et la première
 *     image de l'aperçu (shared `previewDelay.ts`, 800 ms par défaut) — le
 *     MÊME que celui des cartes du cœur (additif : une extension face à un
 *     hôte d'avant garde le sien).
 *
 * Générique : n'importe quelle extension qui montre des aperçus le lit. La
 * capacité du serveur (`trailers.preview`), elle, se lit sur `/api/config`.
 *
 * ⚠️ API PUBLIQUE des extensions : les noms des messages, du champ
 * `trailerPreview` et de l'évènement ne se renomment jamais.
 */
export interface PluginTrailerPreviewEnv {
  enabled: boolean;
  muted: boolean;
  volume: number;
  delayMs: number;
}

/** L'hôte → l'iframe : l'état a changé (réglage, son, connectivité…). */
export const TRAILER_PREVIEW_ENV_MESSAGE = "TRAILER_PREVIEW_ENV";
/** L'iframe → l'hôte : le son des aperçus coupé ou rendu d'un geste dans l'extension. */
export const TRAILER_PREVIEW_MUTED_MESSAGE = "TRAILER_PREVIEW_MUTED";
/** L'iframe → l'hôte : le volume des aperçus réglé dans l'extension (0 à 1). */
export const TRAILER_PREVIEW_VOLUME_MESSAGE = "TRAILER_PREVIEW_VOLUME";
/** L'évènement que le pont émet sur la `window` de l'iframe à chaque changement. */
export const TRAILER_PREVIEW_ENV_EVENT = "tentacle:trailerpreview";

/** L'état courant, pour le `hostEnv` du document de l'iframe. */
export function pluginTrailerPreviewEnv(): PluginTrailerPreviewEnv {
  return {
    enabled: getTrailerPreviewBlock() === null, muted: trailerPreviewMutedFlag.get(), volume: trailerPreviewVolumeLevel.get(),
    delayMs: trailerPreviewDelayChoice.get(),
  };
}

/**
 * Suit l'état EN DIRECT : `push` reçoit chaque changement effectif (jamais
 * deux fois la même valeur). Rend le désabonnement.
 */
export function watchPluginTrailerPreviewEnv(push: (env: PluginTrailerPreviewEnv) => void): () => void {
  let last = pluginTrailerPreviewEnv();
  const refresh = () => {
    const next = pluginTrailerPreviewEnv();
    if (next.enabled === last.enabled && next.muted === last.muted && next.volume === last.volume && next.delayMs === last.delayMs) return;
    last = next;
    push(next);
  };
  const unsubscribers = [
    subscribeTrailerPreviewBlock(refresh), trailerPreviewMutedFlag.subscribe(refresh), trailerPreviewVolumeLevel.subscribe(refresh),
    trailerPreviewDelayChoice.subscribe(refresh),
  ];
  // L'abonnement au blocage le recalcule : un écart avec la lecture d'avant se dit tout de suite.
  refresh();
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

/**
 * Le message `TRAILER_PREVIEW_MUTED` d'une extension : un booléen, rien
 * d'autre — il n'écrit QUE le drapeau du son des aperçus. Rend `false` pour
 * un message invalide (ignoré).
 */
export function applyPluginTrailerPreviewMuted(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const muted = (data as { muted?: unknown }).muted;
  if (typeof muted !== "boolean") return false;
  trailerPreviewMutedFlag.set(muted);
  return true;
}

/**
 * Le message `TRAILER_PREVIEW_VOLUME` d'une extension : un nombre de 0 à 1,
 * rien d'autre — il n'écrit QUE le volume des aperçus (zéro coupe le son, une
 * valeur au-dessus le rend). Rend `false` pour un message invalide (ignoré).
 */
export function applyPluginTrailerPreviewVolume(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const volume = (data as { volume?: unknown }).volume;
  if (typeof volume !== "number" || !Number.isFinite(volume) || volume < 0 || volume > 1) return false;
  if (volume > 0) trailerPreviewVolumeLevel.set(volume);
  trailerPreviewMutedFlag.set(volume === 0);
  return true;
}

/** Le message de l'hôte à poster dans l'iframe. */
export function trailerPreviewEnvMessage(env: PluginTrailerPreviewEnv) {
  return { type: TRAILER_PREVIEW_ENV_MESSAGE, enabled: env.enabled, muted: env.muted, volume: env.volume, delayMs: env.delayMs };
}

/** Script du pont (méthode de `__tentacle_bridge`, sans virgule finale) : le son coupé d'un geste. */
export function buildTrailerPreviewBridgeMethod(): string {
  return `
      // Le son des aperçus de bande-annonce, coupé ou rendu dans l'extension :
      // l'hôte le retient sur l'appareil (le même réglage que ses cartes).
      setTrailerPreviewMuted: function(muted) {
        parent.postMessage({ type: ${JSON.stringify(TRAILER_PREVIEW_MUTED_MESSAGE)}, muted: muted === true }, "*");
      },
      // Le volume des aperçus (0 à 1), réglé dans l'extension : retenu par l'hôte, comme le son.
      setTrailerPreviewVolume: function(volume) {
        parent.postMessage({ type: ${JSON.stringify(TRAILER_PREVIEW_VOLUME_MESSAGE)}, volume: Number(volume) }, "*");
      }`;
}

/**
 * Script du pont (dans l'écouteur `message`, `e` et `data` en portée) :
 * l'état poussé par l'hôte met à jour `__tentacle_env.trailerPreview` et
 * émet l'évènement. Seul le parent est écouté.
 */
export function buildTrailerPreviewEnvListener(): string {
  return `
      if (data.type === ${JSON.stringify(TRAILER_PREVIEW_ENV_MESSAGE)} && e.source === parent) {
        var tp = { enabled: data.enabled === true, muted: data.muted === true, volume: typeof data.volume === "number" ? data.volume : 0.6 };
        if (typeof data.delayMs === "number") tp.delayMs = data.delayMs;
        window.__tentacle_env.trailerPreview = tp;
        try { window.dispatchEvent(new CustomEvent(${JSON.stringify(TRAILER_PREVIEW_ENV_EVENT)}, { detail: tp })); } catch (err) {}
      }`;
}
