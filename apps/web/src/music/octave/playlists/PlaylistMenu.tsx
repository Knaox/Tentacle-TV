/**
 * Octave — le menu « … » d'une playlist (sa page, ses cartes, le rail ; au clic droit aussi), rendu du modèle
 * partagé des collections (`collectionActions`, `../collections/CollectionMenu`) : le favori (si le serveur le
 * garde), l'ordre de la rubrique (dans la bibliothèque), puis modifier les détails, dupliquer, partager avec des
 * comptes du serveur ou par un lien (si le serveur le sait et le compte en a le droit), supprimer. Une playlist
 * qu'on m'a partagée : « Personnes » et « Quitter la playlist ». La suppression est à part, en rouge, et demande
 * confirmation. Sans rien à offrir (serveur d'avant, playlist d'un autre), ni bouton ni menu.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MusicShelfSubject } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import type { FloatingAnchor } from "../../../components/floating/useFloatingPlacement";
import { CollectionMenuPanel } from "../collections/CollectionMenu";
import { CollectionMenuButton } from "../collections/CollectionMenuButton";

export function playlistSubject(playlist: MusicPlaylist): MusicShelfSubject {
  return { section: "playlists", item: { kind: "library", playlist } };
}

export function usePlaylistSubject(playlist: MusicPlaylist): MusicShelfSubject {
  return useMemo(() => playlistSubject(playlist), [playlist]);
}

export function PlaylistMenuPanel({ playlist, anchor, onClose }: { playlist: MusicPlaylist; anchor: FloatingAnchor; onClose: () => void }) {
  const { t } = useTranslation("music");
  const subject = usePlaylistSubject(playlist);
  return <CollectionMenuPanel subject={subject} anchor={anchor} ariaLabel={t("playlistManage.more", { name: playlist.name })} onClose={onClose} />;
}

interface PlaylistMenuButtonProps {
  playlist: MusicPlaylist;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

/** Le bouton « … » ; rien pour une playlist dont le menu n'aurait rien à offrir. */
export function PlaylistMenuButton({ playlist, open, onOpenChange, className = "h-11 w-11" }: PlaylistMenuButtonProps) {
  const { t } = useTranslation("music");
  const subject = usePlaylistSubject(playlist);
  return <CollectionMenuButton subject={subject} open={open} onOpenChange={onOpenChange} className={className} label={t("playlistManage.more", { name: playlist.name })} />;
}
