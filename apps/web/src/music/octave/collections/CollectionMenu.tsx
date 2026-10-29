/**
 * Octave — le menu d'un album, d'un artiste ou d'une playlist (« … », clic droit, appui long), rendu d'après le
 * modèle partagé (`collectionActions`, crochet `useCollectionMenu`) : favori, ordre de la rubrique, gestion d'une
 * playlist, puis supprimer ou quitter en rouge, chaque groupe séparé. Les gestes du cœur partent d'ici ; modifier,
 * partager, supprimer, quitter passent par l'hôte de gestion des playlists ; « Réordonner », par la rubrique.
 */

import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useCollectionMenu, type MusicShelfSubject } from "@tentacle-tv/api-client";
import { groupCollectionActions, type CollectionActionId } from "@tentacle-tv/shared/octave";
import { FloatingLayer } from "../../../components/floating/FloatingLayer";
import type { FloatingAnchor } from "../../../components/floating/useFloatingPlacement";
import { requestPlaylistManage } from "../playlists/playlistManageStore";
import { usePlaylistManagement } from "../playlists/usePlaylistManagement";
import { COLLECTION_ACTION_LABELS } from "./collectionLabels";
import { useShelfScope } from "./shelfContext";

const itemClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-content-primary hover:bg-octave-hover focus-visible:bg-octave-hover focus-visible:outline-none";

export function subjectName(subject: MusicShelfSubject): string {
  if (subject.section === "albums") return subject.item.title;
  if (subject.section === "artists") return subject.item.name;
  return subject.item.kind === "library" ? subject.item.playlist.name : subject.item.playlist.title;
}

interface PanelProps {
  subject: MusicShelfSubject;
  anchor: FloatingAnchor;
  onClose: () => void;
  ariaLabel: string;
}

export function CollectionMenuPanel({ subject, anchor, onClose, ariaLabel }: PanelProps) {
  // Un espace par crochet : chaque libellé garde l'espace qu'il avait (`collectionLabels.ts`).
  const tr = {
    music: useTranslation("music").t,
    musicShare: useTranslation("musicShare").t,
    musicPlaylistMembers: useTranslation("musicPlaylistMembers").t,
    musicFavorites: useTranslation("musicFavorites").t,
  };
  const scope = useShelfScope(subject.section);
  const menu = useCollectionMenu(subject, scope?.shelf);
  const { duplicate } = usePlaylistManagement();
  const playlist = subject.section === "playlists" && subject.item.kind === "library" ? subject.item.playlist : null;
  const key = menu.key;
  const act = (id: CollectionActionId) => {
    onClose();
    if (menu.run(id)) return;
    if (id === "reorder") return scope?.reorder(key);
    if (!playlist) return;
    if (id === "duplicate") return void duplicate(playlist);
    const kind = id === "edit" ? "edit" : id === "shareLink" ? "share" : id === "shareWith" || id === "members" ? "members" : id === "leave" ? "leave" : "delete";
    requestPlaylistManage({ kind, playlist });
  };
  const groups = groupCollectionActions(menu.actions);
  if (groups.length === 0) return null;
  return (
    <FloatingLayer
      open
      anchor={anchor}
      onDismiss={onClose}
      role="menu"
      ariaLabel={ariaLabel}
      side="bottom"
      align="end"
      className="w-60 p-1.5"
      // Un îlot d'encre PRUNE, opaque, comme le menu d'un titre (IDENTITE.md).
      style={{ background: "var(--oc-ink-raised)", borderRadius: "var(--oc-radius-panel)", boxShadow: "var(--oc-shadow-panel)" }}
    >
      {groups.map((group, i) => (
        <Fragment key={group[0]!.group}>
          {i > 0 && <div role="separator" className="mx-2 my-1.5 h-px bg-line-subtle" />}
          {group.map((action) => {
            const label = COLLECTION_ACTION_LABELS[action.id];
            const Icon = label.icon;
            return (
              <button key={action.id} type="button" role="menuitem" className={`${itemClass} ${action.destructive ? "text-status-error-fg" : ""}`} onClick={() => act(action.id)}>
                <Icon className={`h-4 w-4 ${action.destructive ? "" : "text-content-tertiary"}`} aria-hidden />
                {tr[label.ns](label.key)}
              </button>
            );
          })}
        </Fragment>
      ))}
    </FloatingLayer>
  );
}
