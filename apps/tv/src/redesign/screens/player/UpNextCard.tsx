import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { colors, fonts, white } from "../../theme/tokens";
import { CountdownPill } from "./CountdownPill";
import type { PlayerLabels, UpNextModel } from "./playerTypes";
import { DENSE_BASE } from "./surfaces";

/**
 * La carte « À suivre », pendant le générique, en bas à droite : l'image de
 * l'épisode suivant, son code et son titre, son résumé, et deux gestes —
 * « Lire maintenant » (la pilule blanche, avec l'anneau du décompte) et
 * « Masquer ». Lecture auto éteinte : ni décompte ni anneau, une simple
 * proposition. Clés : `upnext:play`, `upnext:dismiss` ; groupe
 * `upnext:actions` — les deux gestes, où l'intégration retient le focus.
 */

const SAFE = TV_STAGE.safe;
const IMAGE = { width: 320, height: 180 };

export const UpNextCard = memo(function UpNextCard({
  model,
  labels,
  onPlayNext,
  onDismiss,
}: {
  model: UpNextModel;
  labels: Pick<PlayerLabels, "upNext" | "playNow" | "dismiss">;
  onPlayNext?: () => void;
  onDismiss?: () => void;
}) {
  const backing = useNativeGlassBacking("strong");
  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <GlassSurface radius={36} tone="strong" elevated style={[styles.card, backing]}>
        <View style={styles.top}>
          <View style={styles.image}>
            {model.imageUri ? <Image source={{ uri: model.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
          </View>
          <View style={styles.text}>
            <View style={styles.kickerRow}>
              <View style={styles.dot} />
              <Text style={styles.kicker} numberOfLines={1}>{model.countdownLabel ?? labels.upNext}</Text>
            </View>
            {model.code ? <Text style={styles.code} numberOfLines={1}>{model.code}</Text> : null}
            <Text style={styles.title} numberOfLines={2}>{model.title}</Text>
          </View>
        </View>
        {model.overview ? <Text style={styles.overview} numberOfLines={2}>{model.overview}</Text> : null}
        <FocusGroup focusKey="upnext:actions" style={styles.actions}>
          <CountdownPill variant="brand" icon="play" label={labels.playNow} countdown={model.countdown} focusKey="upnext:play" onPress={onPlayNext} />
          <PillButton variant="glass" label={labels.dismiss} focusKey="upnext:dismiss" onPress={onDismiss} />
        </FocusGroup>
      </GlassSurface>
    </View>
  );
});

const styles = StyleSheet.create({
  anchor: { position: "absolute", right: SAFE.x, bottom: SAFE.y },
  card: { width: 880, padding: 30, gap: 22, backgroundColor: DENSE_BASE },
  top: { flexDirection: "row", gap: 26 },
  image: { ...IMAGE, borderRadius: 20, overflow: "hidden", backgroundColor: colors.surface3 },
  text: { flex: 1, gap: 8, justifyContent: "center" },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  kicker: { ...fonts.bold, fontSize: 24, color: colors.accentLight },
  code: { ...fonts.semibold, fontSize: 24, color: white(0.66) },
  title: { ...fonts.bold, fontSize: 30, lineHeight: 36, color: colors.text },
  overview: { ...fonts.regular, fontSize: 24, lineHeight: 32, color: white(0.72) },
  actions: { flexDirection: "row", gap: 18, marginTop: 4 },
});
