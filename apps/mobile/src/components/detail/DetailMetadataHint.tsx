import { memo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  libraryRescanErrorCode,
  useLibraryRescan,
  useMetadataArrival,
  useServerCapability,
} from "@tentacle-tv/api-client";
import { lacksMetadata, type MediaItem } from "@tentacle-tv/shared";
import { CONTENT_MAX_WIDTH, FONT_FAMILY, RADIUS, spacing, useTheme } from "../../theme";
import { useIsAdmin } from "../../hooks/useIsAdmin";

/**
 * Le message d'un titre que Jellyfin n'a pas (encore) trouvé — règle
 * partagée `lacksMetadata`, mots de l'espace `metadataHint` (sans le mot
 * interdit du mobile) : jamais un écran vide, jamais un blocage.
 *
 * Le mobile est une session PERSONNELLE : un administrateur, face à un
 * serveur qui déclare `admin.libraryRescan`, a « Réanalyser maintenant ».
 * La fiche se relit seule à l'arrivée des métadonnées (`useMetadataArrival`,
 * sur le socket que l'accueil tient ouvert).
 */
export const DetailMetadataHint = memo(function DetailMetadataHint({ item }: { item: MediaItem }) {
  const { t } = useTranslation("metadataHint");
  const theme = useTheme();
  const isAdmin = useIsAdmin();
  const canRescan = useServerCapability("admin.libraryRescan") && isAdmin;
  const rescan = useLibraryRescan();
  useMetadataArrival(item);
  if (!lacksMetadata(item)) return null;

  const { text, fill, border, brand } = theme.colors;
  const status = rescan.isSuccess
    ? t("rescanStarted")
    : rescan.isError ? t(`rescanError_${libraryRescanErrorCode(rescan.error)}`) : null;

  return (
    <View
      accessibilityRole="text"
      style={{
        marginHorizontal: spacing.screenPadding, marginTop: spacing.lg, maxWidth: CONTENT_MAX_WIDTH,
        padding: spacing.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: border.subtle, backgroundColor: fill.faint,
      }}
    >
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Feather name="info" size={16} color={text.tertiary} style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, color: text.secondary, fontFamily: FONT_FAMILY.regular, fontSize: 14, lineHeight: 20 }}>
          {t("body")}
        </Text>
      </View>
      {canRescan && (
        <View style={{ marginTop: spacing.md, paddingLeft: 26 }}>
          <Pressable
            onPress={() => rescan.mutate(item)}
            disabled={rescan.isPending || rescan.isSuccess}
            accessibilityRole="button"
            accessibilityLabel={t("rescan")}
            style={({ pressed }) => ({
              alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8,
              paddingHorizontal: 16, height: 40, borderRadius: RADIUS.pill, backgroundColor: fill.soft,
              opacity: rescan.isPending || rescan.isSuccess ? 0.6 : pressed ? 0.75 : 1,
            })}
          >
            {rescan.isPending
              ? <ActivityIndicator size="small" color={brand.light} />
              : <Feather name="refresh-cw" size={14} color={text.primary} />}
            <Text style={{ color: text.primary, fontFamily: FONT_FAMILY.semibold, fontSize: 14 }}>
              {rescan.isPending ? t("rescanning") : t("rescan")}
            </Text>
          </Pressable>
          {status && (
            <Text accessibilityLiveRegion="polite" style={{ marginTop: 8, color: text.secondary, fontFamily: FONT_FAMILY.regular, fontSize: 13, lineHeight: 18 }}>
              {status}
            </Text>
          )}
          <Text style={{ marginTop: 8, color: text.tertiary, fontFamily: FONT_FAMILY.regular, fontSize: 12, lineHeight: 17 }}>
            {t("adminTip")}
          </Text>
        </View>
      )}
    </View>
  );
});
