import { localMediaItem, type LocalFileFacts } from "@tentacle-tv/offline-core";
import type { CardSheetTarget } from "@/components/cards/sheet/cardSheetTarget";

export interface LocalSheetDeps {
  /** Écrit la coche « vu » en base locale (`useLocalWatchedToggle`). */
  setWatched: (played: boolean) => void;
  /** Lire : le lecteur, qui trouve seul le fichier de l'appareil. */
  play: (itemId: string) => void;
  /** Plus d'infos : la fiche LOCALE du titre. */
  open: (itemId: string) => void;
  /** Les visuels posés sur le disque (`resolveLocalArt`), jamais ceux du serveur. */
  images: { poster: string | null; backdrop: string | null };
  /** « Gérer » : la feuille de gestion de l'appareil (`OfflineRowActionsSheet`). */
  manage?: () => void;
}

/**
 * Un titre GARDÉ sur l'appareil, pour la feuille unique des cartes, en mode
 * local (`resolveCardOverlay({ local })`) : Lire ou Reprendre, la coche « vu »
 * — la seule bascule qui vive ici, en base locale —, Plus d'infos vers la
 * fiche locale (vignette 16:9), « Gérer » vers les gestes de l'appareil. Ni
 * Ma liste, ni favori, ni note : ils vivent sur le serveur, que rien
 * n'appelle d'ici.
 *
 * L'affiche d'un épisode montre sa série, comme en ligne : c'est elle qui
 * titre la feuille ; la vignette porte le nom de l'épisode.
 */
export function localSheetTarget(
  entry: LocalFileFacts,
  variant: "poster" | "landscape",
  deps: LocalSheetDeps,
): CardSheetTarget {
  const item = localMediaItem(null, entry);
  const episode = entry.kind === "episode";
  // La bascule inverse l'état qu'ELLE a posé en dernier : la cible est figée à
  // l'ouverture, et deux touches de suite doivent bien aller et revenir.
  let watched = entry.played;
  return {
    variant,
    item,
    title: variant === "poster" && episode && entry.seriesName ? entry.seriesName : item.Name,
    local: true,
    toggles: {
      states: { watchlist: false, favorite: false, watched },
      onToggle: (kind) => {
        if (kind !== "watched") return;
        watched = !watched;
        deps.setWatched(watched);
      },
    },
    navigation: { play: deps.play, open: deps.open },
    images: deps.images,
    manage: deps.manage,
  };
}
