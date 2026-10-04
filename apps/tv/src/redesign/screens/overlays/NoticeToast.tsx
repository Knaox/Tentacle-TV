import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInRight, FadeOutRight, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { BrandGradient } from "../../brand/BrandGradient";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts, white } from "../../theme/tokens";
import { DropShadow } from "../../render/DropShadow";

/**
 * Un avis bref, en haut à droite, qui ne prend JAMAIS le focus : ce qu'un
 * geste vient de faire (« Demande envoyée »), ou pourquoi il ne fait rien
 * (« Ce titre n'est pas disponible dans votre bibliothèque. »). Le même verre
 * que les messages de l'administrateur (`SessionMessages`), la même barre au
 * dégradé de la marque qui se vide : il s'efface seul.
 *
 * Un seul à la fois : le suivant remplace le précédent. Posé par son coin, à
 * sa taille — jamais une vue plein écran par-dessus les focalisables.
 */

export type NoticeKind = "info" | "success" | "error";

export interface NoticeModel {
  id: number;
  kind: NoticeKind;
  title: string;
  /** La phrase qui suit le titre (« Pour suivre son état, … »). */
  text?: string;
  /** Le temps d'affichage ; absent = barre figée (banc). */
  durationMs?: number;
}

const WIDTH = 640;
const RADIUS = 30;

const GLYPH: Record<NoticeKind, { name: IconName; color: string }> = {
  info: { name: "info", color: colors.text },
  success: { name: "check", color: colors.accentLight },
  error: { name: "alert", color: colors.warningFg },
};

function NoticeCard({ notice }: { notice: NoticeModel }) {
  const remaining = useSharedValue(1);
  useEffect(() => {
    if (!notice.durationMs) return;
    remaining.value = withTiming(0, { duration: notice.durationMs, easing: Easing.linear });
  }, [notice.durationMs, remaining]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: remaining.value }] }));
  const backing = useNativeGlassBacking("strong");
  const glyph = GLYPH[notice.kind];
  return (
    <View style={[styles.shadow, backing]}>
      <DropShadow of={[styles.shadow, backing]} />
      <View style={styles.card}>
        <GlassSurface radius={RADIUS} tone="strong" style={StyleSheet.absoluteFill} />
        <View style={styles.body}>
          <View style={styles.glyph}>
            <Icon name={glyph.name} size={30} color={glyph.color} strokeWidth={2.4} />
          </View>
          <View style={styles.texts}>
            <Text style={styles.title} numberOfLines={3}>{notice.title}</Text>
            {notice.text ? <Text style={styles.text} numberOfLines={4}>{notice.text}</Text> : null}
          </View>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, bar]}>
            <BrandGradient />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

export const NoticeToast = memo(function NoticeToast({ notice, top = TV_STAGE.safe.y }: { notice: NoticeModel | null; top?: number }) {
  if (!notice) return null;
  return (
    <View pointerEvents="none" style={[styles.layer, { top }]}>
      <Animated.View key={notice.id} entering={FadeInRight.duration(360)} exiting={FadeOutRight.duration(240)}>
        <NoticeCard notice={notice} />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  layer: { position: "absolute", right: TV_STAGE.safe.x, width: WIDTH },
  // Le fond dense porte l'ombre ; la carte, dessus, rogne la barre aux coins.
  shadow: {
    width: WIDTH,
    borderRadius: RADIUS,
    backgroundColor: "rgba(10, 10, 14, 0.96)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
  },
  card: { borderRadius: RADIUS, overflow: "hidden" },
  body: { flexDirection: "row", gap: 20, paddingHorizontal: 30, paddingTop: 26, paddingBottom: 28 },
  glyph: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: white(0.1) },
  texts: { flex: 1, gap: 8, justifyContent: "center" },
  title: { ...fonts.bold, fontSize: 30, lineHeight: 38, color: colors.text },
  text: { ...fonts.regular, fontSize: 26, lineHeight: 36, color: colors.textSecondary },
  track: { height: 6, backgroundColor: white(0.1) },
  fill: { flex: 1, overflow: "hidden", transformOrigin: "left" },
});
