/**
 * Octave (mobile) — la FILE des transferts, dans la carte : les premiers titres
 * (`PEEK`), puis « Afficher toute la file (n titres) ». Une file de 189 titres
 * dépliée reste légère : rangées à hauteur fixe, rendues d'un coup seulement à
 * la demande. Toucher une rangée ouvre ses actions — reprendre, mettre en pause,
 * réessayer et, séparé, « Retirer de cet appareil ».
 */

import { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { useOctaveColors } from "../theme/octaveColors";
import { KeptActionsSheet, type SheetAction } from "./KeptActionsSheet";
import { applyRowGesture, rowGesture } from "./transferGestures";
import { TransferQueueRow, useStageText } from "./TransferQueueRow";
import { useKeepGestures } from "./useKeepGestures";

const PEEK = 3;
/** Au-delà, la file dépliée s'arrête là : le reste se lit au fil de l'eau (le compte reste dit). */
const UNFOLDED_MAX = 60;

export const TransferQueue = memo(function TransferQueue({ queue }: { queue: readonly KeptMusicTrack[] }) {
  const { t } = useTranslation("musicOffline");
  const colors = useOctaveColors();
  const [unfolded, setUnfolded] = useState(false);
  const [openFileId, setOpenFileId] = useState<number | null>(null);
  const onOpen = useCallback((k: KeptMusicTrack) => setOpenFileId(k.fileId), []);
  if (queue.length === 0) return null;
  const shown = queue.slice(0, unfolded ? UNFOLDED_MAX : PEEK);
  // La rangée ouverte est relue dans la file : son état avance pendant que la feuille est là.
  const open = openFileId === null ? null : (queue.find((k) => k.fileId === openFileId) ?? null);
  return (
    <View style={[styles.wrap, { borderTopColor: colors.line }]}>
      <Text style={[styles.heading, { color: colors.textSecondary }]} accessibilityRole="header">{t("transfers.queue")}</Text>
      {shown.map((k) => <TransferQueueRow key={k.fileId} kept={k} onOpen={onOpen} />)}
      {queue.length > PEEK && (
        <Pressable accessibilityRole="button" onPress={() => setUnfolded((v) => !v)} style={({ pressed }) => [styles.more, pressed && { opacity: 0.6 }]}>
          <Text style={[styles.moreText, { color: colors.accentText }]}>{unfolded ? t("transfers.queueLess") : t("transfers.queueMore", { count: queue.length })}</Text>
        </Pressable>
      )}
      {open && <RowSheet kept={open} onClose={() => setOpenFileId(null)} />}
    </View>
  );
});

function RowSheet({ kept, onClose }: { kept: KeptMusicTrack; onClose: () => void }) {
  const { t } = useTranslation("musicOffline");
  const gestures = useKeepGestures();
  const caption = useStageText(kept);
  const gesture = rowGesture(kept);
  const actions: SheetAction[] = [
    {
      key: gesture,
      label: gesture === "pause" ? t("transfers.pause") : gesture === "resume" ? t("transfers.resume") : t("retry"),
      icon: gesture === "pause" ? "pause" : gesture === "resume" ? "play" : "rotate-cw",
      onPress: () => applyRowGesture(kept, gesture),
    },
    { key: "remove", label: t("remove"), icon: "trash-2", destructive: true, onPress: () => void gestures.remove([kept]) },
  ];
  return <KeptActionsSheet visible onClose={onClose} title={kept.title} caption={caption} actions={actions} />;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  heading: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  more: { minHeight: 44, justifyContent: "center" },
  moreText: { fontSize: 15, fontWeight: "600" },
});
