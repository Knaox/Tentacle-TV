/**
 * Le magasin des réglages de lecture — cache local D'ABORD, serveur ensuite.
 *
 * L'ordre de vérité : l'instantané répond en synchrone depuis le cache de
 * l'appareil (le lecteur doit savoir quoi faire HORS LIGNE, au moment précis
 * où il décide) ; `resynchroniser()` aligne ensuite sur le serveur. Une
 * écriture est optimiste : posée localement tout de suite, poussée en PUT —
 * et si le PUT échoue, la valeur locale reste et sera re-poussée à la
 * prochaine resynchronisation (jamais écrasée par une lecture tant qu'une
 * écriture est en attente).
 *
 * Le SEMIS : à la première resynchronisation d'un compte que le serveur ne
 * connaît pas (`stored: false`), les trois anciennes clés d'appareil sont
 * lues UNE fois. Si elles portent un refus, il est converti et poussé ; si
 * elles sont vierges, rien n'est poussé — un autre appareil, peut-être mieux
 * réglé, garde ainsi le droit de semer.
 */

import { CLES_REGLAGE_APPAREIL } from "../player/reglagesAppareil";
import type { StockageAppareil } from "../player/reglagesAppareil";
import {
  DEFAULT_PLAYBACK_SETTINGS,
  normalizePlaybackSettings,
  type NextEpisodeSettings,
  type PlaybackSettings,
  type SegmentSettings,
} from "./playbackSettings";

export const CLE_CACHE_REGLAGES = "tentacle_playback_settings";

/** Un correctif partiel, par famille — ce que produit une bascule de réglage. */
export interface PlaybackSettingsPatch {
  intro?: Partial<SegmentSettings>;
  outro?: Partial<SegmentSettings>;
  recap?: Partial<SegmentSettings>;
  preview?: Partial<SegmentSettings>;
  next?: Partial<NextEpisodeSettings>;
}

export interface PlaybackSettingsStore {
  sAbonner(rappel: () => void): () => void;
  lireInstantane(): PlaybackSettings;
  definir(patch: PlaybackSettingsPatch): void;
  resynchroniser(): Promise<void>;
  /** Android TV : le cache est rempli par un hydrate() asynchrone au démarrage. */
  rehydrater(): void;
}

export interface DepsMagasinReglages {
  stockage: StockageAppareil;
  /** GET /api/preferences/playback — rend `{ stored, settings }`. */
  lireDistant: () => Promise<unknown>;
  /** PUT /api/preferences/playback. */
  ecrireDistant: (reglages: PlaybackSettings) => Promise<void>;
}

/** Les anciennes clés, converties une seule fois par le semis. */
export function seedFromLegacyDeviceKeys(
  lire: (cle: string) => string | null,
): PlaybackSettings {
  const semis = normalizePlaybackSettings(DEFAULT_PLAYBACK_SETTINGS);
  const eteint = (cle: string): boolean => {
    try {
      return lire(cle) === "false";
    } catch {
      return false;
    }
  };
  if (eteint(CLES_REGLAGE_APPAREIL.sautIntroAuto)) semis.intro.action = "button";
  if (eteint(CLES_REGLAGE_APPAREIL.carteASuivre)) semis.next.nextCard = false;
  if (eteint(CLES_REGLAGE_APPAREIL.decompteEnchainement)) {
    // L'ancienne clé gouvernait le minuteur ET l'acte : on ne fait pas
    // apparaître un enchaînement chez quelqu'un qui l'avait éteint.
    semis.next.nextCountdown = false;
    semis.next.nextAutoPlay = false;
  }
  return semis;
}

const identiques = (a: PlaybackSettings, b: PlaybackSettings): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function creerMagasinReglagesLecture(deps: DepsMagasinReglages): PlaybackSettingsStore {
  const auditeurs = new Set<() => void>();
  let ecritureEnAttente = false;

  const lireCache = (): PlaybackSettings => {
    try {
      const brut = deps.stockage.getItem(CLE_CACHE_REGLAGES);
      return normalizePlaybackSettings(brut === null ? undefined : JSON.parse(brut));
    } catch {
      return normalizePlaybackSettings(undefined);
    }
  };

  let instantane = lireCache();

  const poser = (reglages: PlaybackSettings): void => {
    if (identiques(reglages, instantane)) return;
    instantane = reglages;
    try {
      deps.stockage.setItem(CLE_CACHE_REGLAGES, JSON.stringify(reglages));
    } catch {
      // Stockage indisponible : le réglage vaut pour cette session.
    }
    auditeurs.forEach((auditeur) => auditeur());
  };

  const pousser = async (reglages: PlaybackSettings): Promise<void> => {
    try {
      await deps.ecrireDistant(reglages);
      ecritureEnAttente = false;
    } catch {
      ecritureEnAttente = true;
    }
  };

  return {
    sAbonner(rappel) {
      auditeurs.add(rappel);
      return () => {
        auditeurs.delete(rappel);
      };
    },

    lireInstantane: () => instantane,

    definir(patch) {
      const fusion = normalizePlaybackSettings({
        intro: { ...instantane.intro, ...patch.intro },
        outro: { ...instantane.outro, ...patch.outro },
        recap: { ...instantane.recap, ...patch.recap },
        preview: { ...instantane.preview, ...patch.preview },
        next: { ...instantane.next, ...patch.next },
      });
      poser(fusion);
      ecritureEnAttente = true;
      void pousser(fusion);
    },

    async resynchroniser() {
      // Une écriture attend encore : on re-pousse au lieu de se faire écraser.
      if (ecritureEnAttente) {
        await pousser(instantane);
        return;
      }

      let brut: unknown;
      try {
        brut = await deps.lireDistant();
      } catch {
        return; // Hors ligne : le cache local reste la vérité du moment.
      }

      const reponse = (typeof brut === "object" && brut !== null ? brut : null) as {
        stored?: unknown;
        settings?: unknown;
      } | null;

      if (reponse?.stored === true) {
        poser(normalizePlaybackSettings(reponse.settings));
        return;
      }
      if (reponse?.stored === false) {
        const semis = seedFromLegacyDeviceKeys((cle) => deps.stockage.getItem(cle));
        poser(semis);
        if (!identiques(semis, DEFAULT_PLAYBACK_SETTINGS)) {
          await pousser(semis);
        }
        return;
      }
      // Réponse méconnaissable (proxy, vieille version) : ne rien toucher.
    },

    rehydrater() {
      poser(lireCache());
    },
  };
}
