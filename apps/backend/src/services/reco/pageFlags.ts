import type { RecoState } from "./serveContext";

export interface PageFlagsInput {
  state: RecoState;
  /** Premier contact : le profil se construit en fond. */
  bootstrapping: boolean;
  /** Une reconstruction de profil est en vol (états sans pool). */
  rebuilding: boolean;
  poolAbsent: boolean;
  poolGenerating: boolean;
  /** Le snapshot servi vient d'une passe rapide : la relève arrive. */
  snapshotPoolPreliminary: boolean;
  /** Le pool a été régénéré depuis le snapshot : la page se reconstruit. */
  snapshotBehindPool: boolean;
}

export interface PageFlags {
  /** Rien de personnalisé à montrer encore : le client sonde (ou attend le socket). */
  generating: boolean;
  /** Quelque chose de mieux arrive : bandeau « vos recommandations s'affinent ». */
  refining: boolean;
  /** Toute première visite : « on explore vos goûts ». */
  exploring: boolean;
}

/**
 * Les drapeaux de la page, calculés AU SERVICE (jamais stockés). Un simple
 * rafraîchissement d'âge reste silencieux : remplacement, jamais de bandeau
 * pour un pool de plus de six heures qu'on sert encore.
 */
export function computePageFlags(input: PageFlagsInput): PageFlags {
  const personalized = input.state === "warming" || input.state === "ready";
  const generating = personalized ? input.poolAbsent : input.rebuilding;
  const refining =
    input.bootstrapping ||
    (personalized && (input.poolAbsent || input.snapshotPoolPreliminary || input.snapshotBehindPool)) ||
    (!personalized && input.rebuilding);
  return { generating, refining, exploring: input.bootstrapping };
}
