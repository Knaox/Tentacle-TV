/**
 * La détection des passages (intro, résumé, générique) configurée par
 * Tentacle : les trois greffons Jellyfin qu'il installe, et ce qu'en dit un
 * passage d'installation. Deux portes, un seul moteur — l'assistant
 * d'installation (`/api/setup/jellyfin/segments`) et l'administration
 * (`/api/admin/jellyfin/segment-plugins`).
 *
 * Aucun texte ici : des codes, traduits par l'espace i18n `segmentPlugins`.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/services/segmentPlugins/`
 * (le backend ne dépend pas de `@tentacle-tv/shared`). On le modifie ICI, puis :
 *
 *   cp packages/shared/src/segmentPlugins/segmentPluginsContract.ts apps/backend/src/services/segmentPlugins/
 *
 * `segmentPluginsMirror.test.ts` (backend) refuse toute divergence. Aucun import.
 */

/**
 * Les trois greffons, dans l'ordre où ils s'installent :
 *  - `introSkipper` : Intro Skipper — chapitres, images noires ; son écoute
 *    (Chromaprint) est COUPÉE par Tentacle ;
 *  - `theIntroDb` : TheIntroDB — base en ligne, interrogée au besoin ;
 *  - `skipMeDb` : SkipMe.db — base en ligne, synchronisée chaque jour.
 * « Chapter Segments » n'en fait pas partie : il n'apporte rien de plus.
 */
export type SegmentPluginKey = "introSkipper" | "theIntroDb" | "skipMeDb";

export const SEGMENT_PLUGIN_KEYS: readonly SegmentPluginKey[] = ["introSkipper", "theIntroDb", "skipMeDb"];

/**
 * Ce qu'un passage a fait d'un greffon :
 *  - `present` : déjà là et actif — rien à faire ;
 *  - `installed` : installé par ce passage ;
 *  - `enabled` : il était coupé dans Jellyfin, il est rallumé ;
 *  - `repo-offline` : son dépôt ne répond pas (ou n'a pas pu être ajouté) ;
 *  - `unavailable` : le dépôt répond, mais n'a aucune version pour ce Jellyfin ;
 *  - `too-old` : ce Jellyfin est plus ancien que ce que le greffon exige ;
 *  - `failed` : Jellyfin a refusé ou raté l'installation.
 * Seuls les trois premiers comptent comme « en place » ; les autres ne
 * bloquent jamais rien.
 */
export type SegmentPluginOutcome = "present" | "installed" | "enabled" | "repo-offline" | "unavailable" | "too-old" | "failed";

/**
 * Le redémarrage de Jellyfin qu'exige un greffon installé :
 *  - `not-needed` : rien n'a changé ;
 *  - `done` : redémarré, et revenu ;
 *  - `deferred-playing` : quelqu'un regarde — Tentacle n'a pas coupé sa
 *    lecture ; les réglages se poseront d'eux-mêmes au prochain redémarrage ;
 *  - `timeout` : redémarrage demandé, Jellyfin pas revenu dans les temps ;
 *  - `failed` : Jellyfin a refusé de redémarrer.
 */
export type SegmentRestartOutcome = "not-needed" | "done" | "deferred-playing" | "timeout" | "failed";

export type SegmentSetupPhase = "idle" | "repositories" | "installing" | "restarting" | "configuring" | "done";

/** Pourquoi un passage s'est arrêté avant d'avoir commencé : Jellyfin lui-même. */
export type SegmentSetupError = "not-configured" | "unreachable" | "rejected" | "invalid";

export interface SegmentSetupRun {
  phase: SegmentSetupPhase;
  /** Un passage tourne en ce moment (sur ce serveur, quelle que soit la porte). */
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  /** Un résultat par greffon, `null` tant qu'il n'a pas été traité. */
  plugins: Array<{ key: SegmentPluginKey; outcome: SegmentPluginOutcome | null }>;
  restart: SegmentRestartOutcome | null;
  /**
   * Réglés : l'analyse automatique d'Intro Skipper (et son écoute) coupée,
   * les deux sources en ligne actives. `null` : pas encore, ou rien à régler.
   */
  configured: boolean | null;
  error: SegmentSetupError | null;
}

/** `POST …/segments` (assistant) et `POST /api/admin/jellyfin/segment-plugins`. */
export interface SegmentSetupStartRequest {
  /** Redémarrer Jellyfin même si quelqu'un regarde — seulement sur un geste explicite de l'administrateur. */
  restartWhilePlaying?: boolean;
}

/** Un greffon « en place » après ce passage. */
export function isSegmentPluginInPlace(outcome: SegmentPluginOutcome | null): boolean {
  return outcome === "present" || outcome === "installed" || outcome === "enabled";
}
