import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import type { AvatarCharacter } from "@tentacle-tv/shared";
import { Button } from "@/components/ui";
import { FONT_FAMILY, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { AVATAR_THUMBS } from "../avatarAssets.generated";
import { GALLERY_GUTTER } from "./galleryLayout";

const PORTRAIT = 56;

/** La photo actuelle du compte, montrée tant qu'aucun personnage n'est désigné. */
export interface CurrentPhoto {
  uri: string | null;
  initial: string;
}

interface AvatarStoryFooterProps {
  character: AvatarCharacter | null;
  current: CurrentPhoto;
  invite: boolean;
  busy: boolean;
  onCancel: () => void;
  onChoose: () => void;
}

/**
 * Le pied de la galerie, fixe sous la grille : on y fait connaissance — le
 * personnage désigné s'y présente (portrait, nom, histoire), sinon la photo
 * actuelle et ce qu'il faut faire. Puis « Annuler » (« Pas maintenant » pour
 * l'invitation) et UNE action principale, « Choisir {{name}} ». Le lecteur
 * d'écran reçoit l'histoire par l'annonce de la galerie, pas par une région
 * vivante (Android la dirait deux fois).
 */
export const AvatarStoryFooter = memo(function AvatarStoryFooter({
  character,
  current,
  invite,
  busy,
  onCancel,
  onChoose,
}: AvatarStoryFooterProps) {
  const { t } = useTranslation("avatars");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const name = character ? t(`characters.${character.id}.name`) : null;

  return (
    <View style={st.footer}>
      <View style={st.story}>
        <View style={[st.portrait, character ? { backgroundColor: character.tone } : null]}>
          {character ? (
            <Image key={character.id} source={AVATAR_THUMBS[character.id]} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
          ) : current.uri ? (
            <Image source={{ uri: current.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
          ) : (
            <LinearGradient
              colors={[theme.colors.brand.dark, theme.colors.brand.violet, theme.colors.brand.light]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, st.initialBox]}
            >
              <Text style={st.initial}>{current.initial}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={st.words}>
          <Text style={st.name} numberOfLines={1}>
            {name ?? (current.uri ? t("current") : t("noPhoto"))}
          </Text>
          <Text style={st.text} numberOfLines={3}>
            {character ? t(`characters.${character.id}.story`) : t("mobile.pickHint")}
          </Text>
        </View>
      </View>
      <View style={st.actions}>
        <Button variant="secondary" title={invite ? t("notNow") : t("cancel")} onPress={onCancel} />
        <View style={st.primary}>
          <Button
            fullWidth
            title={name ? t("choose", { name }) : t("chooseIdle")}
            accessibilityLabel={busy ? t("applying") : undefined}
            loading={busy}
            disabled={!character}
            onPress={onChoose}
          />
        </View>
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border.subtle,
      paddingHorizontal: GALLERY_GUTTER,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.md,
    },
    story: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 74 },
    portrait: {
      width: PORTRAIT,
      height: PORTRAIT,
      borderRadius: PORTRAIT / 2,
      overflow: "hidden",
      backgroundColor: t.colors.fill.subtle,
    },
    initialBox: { alignItems: "center", justifyContent: "center" },
    initial: { fontSize: 24, fontFamily: FONT_FAMILY.extrabold, color: t.colors.cta.brandFg },
    words: { flex: 1, gap: 2 },
    name: { ...typography.bodyBold, fontSize: 16, color: t.colors.text.primary },
    text: { ...typography.caption, lineHeight: 18, color: t.colors.text.secondary },
    actions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    primary: { flex: 1 },
  });
