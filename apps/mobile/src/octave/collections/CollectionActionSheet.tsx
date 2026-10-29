/**
 * Octave mobile — la FEUILLE D'ACTIONS d'un album, d'un artiste ou d'une playlist (appui maintenu, « ⋯ ») :
 * le modèle partagé du bureau (`useCollectionMenu` → `collectionActions`), en groupes séparés d'un trait —
 * favori, ordre (« Mettre en haut », « Réordonner »), la playlist (modifier, dupliquer, partager, personnes),
 * puis supprimer ou quitter, en rouge et confirmé. Le cœur et « Mettre en haut » se font ici ; le reste passe
 * à la feuille qui le sait (`handOffSheet`). Hors ligne, tout geste attend le serveur : les lignes sont
 * éteintes et la feuille dit pourquoi — jamais un geste perdu en silence.
 */

import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ArrowUpToLine, Copy, GripVertical, Heart, HeartOff, Link2, LogOut, Pencil, Trash2, Users, type LucideIcon } from "lucide-react-native";
import { useCollectionMenu, useToggleShelfFavorite } from "@tentacle-tv/api-client";
import { collectionActionLabelKey, groupCollectionActions, type CollectionActionId } from "@tentacle-tv/shared/octave";
import { BottomSheet } from "@/components/ui";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { SheetAction } from "../pages/actions/SheetAction";
import { handOffSheet } from "../pages/actions/sheetHandoff";
import { showNotice } from "../pages/env/notices";
import { openPlaylistSheet } from "../playlists/sheets/playlistSheetStore";
import { useMobilePlaylistManage } from "../playlists/sheets/useMobilePlaylistManage";
import { CollectionSheetHeader, subjectName } from "./CollectionSheetHeader";
import { closeCollectionSheet, useCollectionSheet, type CollectionSheetRequest } from "./collectionSheetStore";

const ICONS: Record<CollectionActionId, LucideIcon> = {
  favorite: Heart,
  unfavorite: HeartOff,
  moveTop: ArrowUpToLine,
  reorder: GripVertical,
  edit: Pencil,
  duplicate: Copy,
  shareWith: Users,
  shareLink: Link2,
  members: Users,
  leave: LogOut,
  delete: Trash2,
};

function SheetBody({ request }: { request: CollectionSheetRequest }) {
  const { t } = useTranslation("musicFavorites");
  const { t: to } = useTranslation("musicOffline");
  const theme = useTheme();
  const offline = useOfflineMode();
  const { subject, shelf, onReorder } = request;
  const menu = useCollectionMenu(subject, shelf);
  const toggle = useToggleShelfFavorite();
  const manage = useMobilePlaylistManage();
  const playlist = subject.section === "playlists" && subject.item.kind === "library" ? subject.item.playlist : null;
  const name = subjectName(subject);
  // La suivante (feuille, confirmation) une fois celle-ci retirée.
  const then = (next: () => void) => handOffSheet(closeCollectionSheet, next);

  const favorite = (on: boolean) => {
    haptic("success");
    closeCollectionSheet();
    toggle.mutate(
      { subject, favorite: on },
      {
        onSuccess: () => showNotice("success", t(on ? "added" : "removed", { name })),
        onError: () => showNotice("error", t("failed")),
      },
    );
  };

  const run = (id: CollectionActionId) => {
    if (id === "favorite" || id === "unfavorite") return favorite(id === "favorite");
    if (id === "moveTop") {
      haptic("commit");
      closeCollectionSheet();
      menu.run(id);
      return;
    }
    if (id === "reorder") return then(() => onReorder?.());
    if (!playlist) return;
    switch (id) {
      case "edit":
        return then(() => openPlaylistSheet({ kind: "rename", playlist }));
      case "duplicate":
        return then(() => void manage.duplicate(playlist));
      case "shareWith":
      case "members":
      case "leave":
        // Les personnes d'une playlist : la partager, les voir, la quitter (confirmé dans la feuille).
        return then(() => openPlaylistSheet({ kind: "members", playlist }));
      case "shareLink":
        return then(() => openPlaylistSheet({ kind: "share", playlist }));
      case "delete":
        return then(() => manage.confirmDelete(playlist));
    }
  };

  // « Réordonner » n'a de sens que là où la page sait passer en mode glisser.
  const actions = menu.actions.filter((a) => a.id !== "reorder" || onReorder);
  const groups = groupCollectionActions(actions);
  return (
    <View style={styles.body}>
      {offline ? <Text style={[typography.caption, styles.offline, { color: theme.colors.text.tertiary }]}>{to("view.offlineHint")}</Text> : null}
      {groups.map((group, gi) => (
        <Fragment key={group[0]!.id}>
          {gi > 0 ? <View style={[styles.separator, { backgroundColor: theme.colors.border.subtle }]} /> : null}
          {group.map((a) => (
            <SheetAction
              key={a.id}
              icon={ICONS[a.id]}
              label={t(collectionActionLabelKey(a.id))}
              tone={a.destructive ? "danger" : a.id === "unfavorite" ? "accent" : undefined}
              filled={a.id === "unfavorite"}
              disabled={offline}
              onPress={() => run(a.id)}
            />
          ))}
        </Fragment>
      ))}
    </View>
  );
}

export function CollectionActionSheet() {
  const request = useCollectionSheet();
  return (
    <BottomSheet visible={request !== null} onClose={closeCollectionSheet} snapPoints={[0.5, 0.78]} header={request ? <CollectionSheetHeader subject={request.subject} /> : null}>
      {request ? <SheetBody request={request} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 8, paddingBottom: 24 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 6, marginHorizontal: 20 },
  offline: { paddingHorizontal: 20, paddingBottom: 8 },
});
