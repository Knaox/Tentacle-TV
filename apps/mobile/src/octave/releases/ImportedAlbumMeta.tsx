/**
 * Octave mobile — dans la tête d'un album IMPORTÉ : la pastille « Importé », et « Voir sur Bandcamp » (l'acheter,
 * la soutenir) quand la sortie vient d'un lien — jamais pour des fichiers seuls. Seule une page https s'ouvre.
 */

import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react-native";
import { typography, useTheme } from "@/theme";
import { ImportedBadge } from "./ImportedBadge";

export function ImportedAlbumMeta({ sourceUrl }: { sourceUrl: string | null }) {
  const { t } = useTranslation("musicReleases");
  const theme = useTheme();
  const source = sourceUrl && /^https:\/\//i.test(sourceUrl) ? sourceUrl : null;
  return (
    <>
      <ImportedBadge variant="inline" />
      {source ? (
        <Pressable onPress={() => void Linking.openURL(source)} hitSlop={10} accessibilityRole="link" style={styles.link}>
          <Text style={[typography.caption, styles.text, { color: theme.colors.text.secondary }]}>{t("viewOnBandcamp")}</Text>
          <ExternalLink size={13} color={theme.colors.text.secondary} />
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 22 },
  text: { fontWeight: "600" },
});
