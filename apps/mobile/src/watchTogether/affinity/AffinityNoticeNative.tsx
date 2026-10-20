import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { clearAffinityNotice, useAffinityStore } from "@tentacle-tv/api-client";
import { FONT_FAMILY, RADIUS, useThemedStyles, type AppTheme } from "@/theme";

/** Durée d'un fait du groupe dit dans la modale. */
const NOTICE_MS = 4_000;

/**
 * Ce que les autres viennent de faire (lancer, quitter, écarter un match…),
 * dit DANS la modale de l'affinité — un message de l'app passerait dessous.
 */
export function AffinityNoticeNative() {
  const { notice } = useAffinityStore();
  const s = useThemedStyles(makeStyles);
  const id = notice?.id;
  useEffect(() => {
    if (id === undefined) return;
    const timer = setTimeout(() => clearAffinityNotice(id), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [id]);
  if (!notice) return null;
  return (
    <View pointerEvents="none" style={s.wrap}>
      <Text style={s.text} accessibilityLiveRegion="polite" numberOfLines={2}>{notice.text}</Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  wrap: {
    position: "absolute", top: 8, left: 16, right: 16, zIndex: 10, alignItems: "center",
  },
  text: {
    overflow: "hidden", paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill,
    backgroundColor: t.colors.glass.panel, color: t.colors.text.primary, fontSize: 14, fontFamily: FONT_FAMILY.medium,
  },
});
