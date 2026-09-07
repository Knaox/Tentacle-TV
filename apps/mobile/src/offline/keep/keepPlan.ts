/**
 * Le plan de variantes d'une demande « Garder hors ligne » : pour UN titre,
 * la décision pure du cœur ; pour un LOT (saison, série, sélection), pas de
 * panachage — une carte ne reste que si TOUS les épisodes la proposent, et
 * elle s'aligne sur le pire d'entre eux (avertissement audio, taille estimée).
 *
 * Sur le téléphone, on ne CHOISIT pas de perdre de l'image : l'original quand
 * l'appareil le lit, sinon la copie sans réencodage, et l'Allégé seulement
 * quand rien d'autre ne passe.
 */

import type { MediaItem } from "@tentacle-tv/shared";
import {
  offlineVariantsFor,
  type DownloadCapabilities,
  type OfflineVariantCard,
  type OfflineVariantKind,
  type OfflineVariantPlan,
  type PlatformMediaSupport,
} from "@tentacle-tv/offline-core";

const KINDS: readonly OfflineVariantKind[] = ["original", "remux", "light"];

/** La règle du mobile : jamais d'Allégé à côté d'une version sans perte. */
const LOSSLESS_FIRST = { lossyAsLastResort: true } as const;

export function planForItems(
  items: readonly MediaItem[],
  platform: PlatformMediaSupport,
  capabilities: DownloadCapabilities,
): OfflineVariantPlan {
  if (items.length === 0) return { cards: [], excluded: [] };
  const plans = items.map((item) => offlineVariantsFor(item, platform, capabilities, LOSSLESS_FIRST));
  if (plans.length === 1) return plans[0] as OfflineVariantPlan;

  const cards: OfflineVariantCard[] = [];
  const excluded: OfflineVariantPlan["excluded"] = [];
  for (const kind of KINDS) {
    const perItem = plans.map((plan) => plan.cards.find((card) => card.kind === kind) ?? null);
    if (perItem.some((card) => card === null)) {
      // Le premier épisode qui l'exclut donne la raison.
      const reason = plans.flatMap((plan) => plan.excluded).find((entry) => entry.kind === kind);
      if (reason !== undefined) excluded.push(reason);
      continue;
    }
    const found = perItem as OfflineVariantCard[];
    const allSized = found.every((card) => card.sizeBytes !== null);
    cards.push({
      kind,
      reason: found.find((card) => card.reason !== "playable")?.reason ?? "playable",
      audio: {
        playable: [],
        unplayable: found.flatMap((card) => card.audio.unplayable),
      },
      sizeBytes: allSized ? found.reduce((sum, card) => sum + (card.sizeBytes ?? 0), 0) : null,
      sizeIsEstimate: found.some((card) => card.sizeIsEstimate),
    });
  }
  return { cards, excluded };
}
