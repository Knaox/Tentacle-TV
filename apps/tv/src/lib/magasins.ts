import { initPlaybackSettingsStore, rehydratePlaybackSettings } from "@tentacle-tv/api-client";
import { magasinEpinglageRail } from "../components/nav/railPinning";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * Les magasins de réglages sont créés au CHARGEMENT DES MODULES, avant que le
 * stockage natif ne soit hydraté : sur Android TV, `getItem` ne lit qu'un cache
 * rempli par un `hydrate()` asynchrone. Sans cette relecture, chaque réglage
 * repart à sa valeur par défaut à chaque démarrage — c'est le défaut qui avait
 * fait réapparaître les entrées masquées du rail.
 *
 * Le magasin des réglages de LECTURE, lui, ne naît qu'au premier rendu qui
 * l'utilise (il lui faut le `StorageAdapter` du contexte). On le crée donc ici,
 * à la main, avant de le relire : `rehydratePlaybackSettings()` seul serait un
 * no-op silencieux sur un magasin qui n'existe pas encore.
 *
 * À appeler une fois, juste après `hydrate()`.
 */
export function rehydraterMagasins(): void {
  magasinEpinglageRail.rehydrater();
  initPlaybackSettingsStore(tvStorage);
  rehydratePlaybackSettings();
}
