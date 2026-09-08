/**
 * Le plan de variantes d'une demande « Garder hors ligne » : pour UN titre,
 * la décision pure du cœur ; pour un LOT (saison, série, sélection), pas de
 * panachage — une carte ne reste que si TOUS les épisodes la proposent, et
 * elle s'aligne sur le pire d'entre eux (avertissement audio, taille estimée).
 *
 * L'ordre des cartes fait le défaut — l'original quand l'appareil lit le
 * fichier, sinon la copie sans réencodage — mais l'Allégé reste offert à côté :
 * sur un téléphone, réduire la taille d'un titre est un besoin.
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

export function planForItems(
  items: readonly MediaItem[],
  platform: PlatformMediaSupport,
  capabilities: DownloadCapabilities,
): OfflineVariantPlan {
  if (items.length === 0) return { cards: [], excluded: [] };
  const plans = items.map((item) => offlineVariantsFor(item, platform, capabilities));
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
