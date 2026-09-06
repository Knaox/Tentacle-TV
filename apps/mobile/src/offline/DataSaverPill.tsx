import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, typography, useThemedStyles, type AppTheme } from "@/theme";
import { DataSaverSheet } from "./DataSaverSheet";
import { useConnectivity } from "./useConnectivity";
import { useDataSaverActive } from "./useDataSaver";

/**
 * La pastille « Économie » de l'en-tête — visible seulement quand le mode est
 * actif ET en ligne (hors ligne, la pastille « Hors ligne » prime : deux
 * pastilles diraient la même chose). Elle existe parce que le mode change des
 * choses visibles (images plus douces, accueil au fil du défilement) : sans
 * explication ça se lit comme un défaut, avec, comme une adaptation.
 */
export function DataSaverPill() {
  const { t } = useTranslation("downloads");
  const { state } = useConnectivity();
  const active = useDataSaverActive();
  const st = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);

  const offline = state === "offline-auto" || state === "offline-manual";
  if (!active || offline) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("saverPopoverTitle")}
        style={({ pressed }) => [st.pill, pressed && st.pressed]}
      >
        <View style={st.dot} />
        <Text style={st.label} numberOfLines={1}>{t("saverChip")}</Text>
      </Pressable>
      <DataSaverSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 28,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    pressed: { opacity: 0.75 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.text.tertiary },
    label: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  });
