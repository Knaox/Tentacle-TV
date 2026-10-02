/**
 * La relance du flux — contrat commun aux deux variantes de `useTVStreamUrl`
 * (tvOS, Android TV), exposé par `usePlayerStreamPipeline` (`restartStream`).
 *
 * Relancer, c'est reconstruire la source À UNE POSITION, sous la MÊME forme —
 * PrismCore reste PrismCore, même palier de qualité, mêmes pistes —, en
 * rechargement DOUX : jamais l'écran de chargement, jamais l'état d'échec,
 * jamais le transcodage forcé. Appelants : le retour au premier plan
 * (bouclage PrismCore mort pendant la suspension), la reprise après une
 * coupure du serveur ou de Jellyfin ou une mort du producteur de PrismCore,
 * et la sortie audio revenue (`useAudioErrorRetry`) ; et, gardant la session
 * du serveur (`keepSession`), un transcodage dont AVPlayer a abandonné un
 * segment qui tardait (`useTranscodeReload`).
 *
 * - "ok" : la nouvelle URL est émise (la lecture repart de `at`) ;
 * - "failed" : la résolution a échoué — l'état courant reste tel quel ;
 * - "busy" : une relance est déjà en vol.
 */
export type RestartReason = "resume" | "network" | "audio" | "remux" | "manual" | "transcode";
export type RestartOutcome = "ok" | "failed" | "busy";

/**
 * Où la source relancée démarre : une position, ou sa lecture au moment où
 * l'URL est ÉMISE — une recherche faite pendant la réouverture déplace la
 * cible (`useStreamRestart`), et la nouvelle source part de là, pas de la
 * position d'avant.
 */
export type RestartAt = number | (() => number);

export function resolveRestartAt(at: RestartAt): number {
  return Math.max(0, typeof at === "function" ? at() : at);
}
export interface RestartOptions {
  /** Position de reprise, timeline absolue — défaut : la position courante. */
  at?: number;
  reason: RestartReason;
  /** La MÊME session du serveur, rechargée — un transcodage qui tarde : le
   *  travail déjà fait l'attend. Sans session à garder, une relance ordinaire. */
  keepSession?: boolean;
  /** `false` : pas de pause de rechargement (l'élément sortant ne joue plus
   *  rien, et un AVPlayer en pause cesse de remplir sa mémoire). */
  hold?: boolean;
}

/**
 * Une URL DIFFÉRENTE qui désigne la même chose : sur une URL inchangée, le
 * lecteur natif ne recharge rien (lecture directe, où l'URL ne porte ni
 * session ni port). Jellyfin ignore le paramètre (vérifié : 206 sur
 * `/Videos/{id}/stream`). Il se pose AVANT le fragment `#tnt-start`, que le
 * natif Android lit jusqu'au bout de l'URL.
 */
/** L'URL sans sa marque de relance (`tntRestart`), fragment gardé. */
export function withoutRestartMark(url: string): string {
  const hash = url.indexOf("#");
  const base = hash >= 0 ? url.slice(0, hash) : url;
  const fragment = hash >= 0 ? url.slice(hash) : "";
  const cleaned = base.replace(/([?&])tntRestart=\d+(&?)/, (_match, lead: string, tail: string) => (tail ? lead : ""));
  return cleaned + fragment;
}

export function withRestartMark(url: string, mark: number): string {
  if (mark <= 0) return url;
  const hash = url.indexOf("#");
  const base = hash >= 0 ? url.slice(0, hash) : url;
  const fragment = hash >= 0 ? url.slice(hash) : "";
  return `${base}${base.includes("?") ? "&" : "?"}tntRestart=${mark}${fragment}`;
}
