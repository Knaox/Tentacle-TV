import { memo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AVATAR_COLLECTIONS, avatarsOf } from "@tentacle-tv/shared";
import { spacing, typography, useThemedStyles, type AppTheme } from "@/theme";
import { AvatarTile } from "./AvatarTile";
import { UploadTile } from "./UploadTile";
import { GALLERY_GAP, GALLERY_GUTTER, type GalleryLayout } from "./galleryLayout";

interface AvatarGridProps {
  layout: GalleryLayout;
  designatedId: string | null;
  disabled: boolean;
  onTile: (id: string) => void;
  onUpload: () => void;
}

/**
 * Le corps de la galerie, qui défile : « Votre photo » (l'import) en tête, puis
 * les trois collections, chacune en grille sous son titre.
 */
export const AvatarGrid = memo(function AvatarGrid({ layout, designatedId, disabled, onTile, onUpload }: AvatarGridProps) {
  const { t } = useTranslation("avatars");
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Section title={t("yourPhoto")}>
        <UploadTile disabled={disabled} layout={layout} onPress={onUpload} />
      </Section>
      {AVATAR_COLLECTIONS.map((collection) => (
        <Section key={collection} title={t(`collections.${collection}`)}>
          {avatarsOf(collection).map((avatar) => (
            <AvatarTile
              key={avatar.id}
              avatar={avatar}
              name={t(`characters.${avatar.id}.name`)}
              designated={designatedId === avatar.id}
              disabled={disabled}
              layout={layout}
              onPress={onTile}
            />
          ))}
        </Section>
      ))}
    </ScrollView>
  );
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  const st = useThemedStyles(makeSectionStyles);
  return (
    <View style={styles.section}>
      <Text style={st.title} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: GALLERY_GUTTER, paddingBottom: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: GALLERY_GAP, rowGap: spacing.sm },
});

const makeSectionStyles = (t: AppTheme) =>
  StyleSheet.create({
    title: { ...typography.small, color: t.colors.text.tertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  });
