import {
  initPlaybackSettingsStore, initStillWatchingStore, rehydratePlaybackSettings, rehydrateStillWatching,
} from "@tentacle-tv/api-client";
import { railPinningStore } from "../components/nav/railPinning";
import { bootSoundStore } from "./bootSoundSetting";
import { cardSizeStore } from "./cardSize";
import { exoTunnelingStore } from "./exoSettings";
import { liquidGlassStore } from "./liquidGlass";
import { rehydrateTrailerPreviewSettings } from "./trailerPreviewSettings";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * Les magasins de réglages sont créés au CHARGEMENT DES MODULES, avant que le
 * stockage natif ne soit hydraté : sur Android TV, `getItem` ne lit qu'un cache
 * rempli par un `hydrate()` asynchrone. Sans cette relecture, chaque réglage
 * repart à sa valeur par défaut à chaque démarrage — c'est le défaut qui avait
 * fait réapparaître les entrées masquées du rail.
 *
 * Les magasins des réglages de LECTURE et de « Vous regardez encore ? », eux,
 * ne naissent qu'au premier rendu qui les utilise (il leur faut le
 * `StorageAdapter` du contexte). On les crée donc ici, à la main, avant de les
 * relire : `rehydrate…()` seul serait un no-op silencieux sur un magasin qui
 * n'existe pas encore.
 *
 * À appeler une fois, juste après `hydrate()`.
 */
export function rehydrateStores(): void {
  railPinningStore.rehydrate();
  exoTunnelingStore.rehydrate();
  liquidGlassStore.rehydrate();
  cardSizeStore.rehydrate();
  bootSoundStore.rehydrate();
  // Les aperçus au focus : sans cette relecture, un aperçu coupé (ou muet) se rallumait au démarrage.
  rehydrateTrailerPreviewSettings();
  initPlaybackSettingsStore(tvStorage);
  rehydratePlaybackSettings();
  initStillWatchingStore(tvStorage);
  rehydrateStillWatching();
}
