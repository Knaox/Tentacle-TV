import { View, Text, StyleSheet, Linking, Pressable } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMediaLicense } from "../hooks/useMediaLicense";
import { colors, spacing, typography } from "../theme";

const ROLE_I18N_KEYS: Record<string, string> = {
  Director: "media:licenseDirector",
  Producer: "media:licenseProducer",
  "Executive Producer": "media:licenseExecutiveProducer",
  "Concept Art": "media:licenseConceptArt",
  Studio: "media:licenseStudio",
};

interface LicenseAttributionProps {
  item: MediaItem;
}

export function LicenseAttribution({ item }: LicenseAttributionProps) {
  const { t } = useTranslation("media");
  const license = useMediaLicense(item);

  if (!license) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Feather name="shield" size={18} color={colors.textSecondary} />
        <Text style={styles.title}>{t("media:licenseTitle")}</Text>
      </View>

      {/* License badge & name */}
      <Pressable
        onPress={() => Linking.openURL(license.license.url)}
        style={styles.badgeContainer}
      >
        {license.license.badgeUrl && (
          <Image
            source={{ uri: license.license.badgeUrl }}
            style={styles.badge}
            contentFit="contain"
          />
        )}
        <Text style={styles.licenseName}>{license.license.fullName}</Text>
      </Pressable>

      {/* Creators */}
      {license.attribution.creators.length > 0 && (
        <View style={styles.creatorsRow}>
          {license.attribution.creators.map((creator) => (
            <View key={`${creator.role}-${creator.name}`} style={styles.creatorItem}>
              <Text style={styles.creatorRole}>
                {ROLE_I18N_KEYS[creator.role] ? t(ROLE_I18N_KEYS[creator.role]) : creator.role}
              </Text>
              {creator.url ? (
                <Pressable onPress={() => Linking.openURL(creator.url!)}>
                  <Text style={styles.creatorNameLink}>{creator.name}</Text>
                </Pressable>
              ) : (
                <Text style={styles.creatorName}>{creator.name}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Source */}
      {license.attribution.sourceUrl ? (
        <Pressable
          onPress={() => Linking.openURL(license.attribution.sourceUrl)}
          style={styles.sourceContainer}
        >
          <Text style={styles.sourceLabel}>{t("media:licenseSource")}</Text>
          <View style={styles.sourceLink}>
            <Text style={styles.sourceName}>
              {license.attribution.sourceName || license.attribution.sourceUrl}
            </Text>
            <Feather name="external-link" size={12} color={colors.accentLight} />
          </View>
        </Pressable>
      ) : null}

      {/* Modifications */}
      {license.modifications && (
        <View style={styles.modContainer}>
          <Text style={styles.modLabel}>{t("media:licenseModifications")}</Text>
          <Text style={styles.modText}>{license.modifications}</Text>
        </View>
      )}

      {/* Copyright notice */}
      <Text style={styles.copyright}>{license.attribution.copyrightNotice}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.screenPadding,
    marginTop: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.subtitle,
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 16,
  },
  badgeContainer: {
    marginBottom: spacing.md,
  },
  badge: {
    width: 88,
    height: 31,
    marginBottom: 6,
  },
  licenseName: {
    ...typography.caption,
    color: colors.accentLight,
    fontWeight: "500",
  },
  creatorsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  creatorItem: {
    minWidth: 100,
  },
  creatorRole: {
    ...typography.badge,
    color: colors.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  creatorName: {
    ...typography.caption,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  creatorNameLink: {
    ...typography.caption,
    color: colors.accentLight,
    marginTop: 2,
  },
  sourceContainer: {
    marginBottom: spacing.sm,
  },
  sourceLabel: {
    ...typography.badge,
    color: colors.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  sourceName: {
    ...typography.caption,
    color: colors.accentLight,
  },
  modContainer: {
    marginBottom: spacing.sm,
  },
  modLabel: {
    ...typography.badge,
    color: colors.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  copyright: {
    ...typography.badge,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
  },
});
