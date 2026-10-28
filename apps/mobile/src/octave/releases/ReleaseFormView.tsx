/**
 * Octave mobile — le formulaire de la feuille « Importer une sortie » : un LIEN Bandcamp (reconnu en tapant),
 * OU des fichiers du téléphone (le sélecteur du système). Une seule action principale : celle de ce qui est
 * rempli. Seules les sources que l'extension déclare s'offrent.
 */

import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { FileAudio, X } from "lucide-react-native";
import { RELEASE_FILES_PER_JOB, recognizeReleaseUrl, type ReleaseSource } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { OctavePlayButton } from "../layout/OctavePlayButton";
import type { PhonePick } from "./phoneReleaseFiles";

/** 1,2 Mo, 640 Ko. */
export function sizeLabel(bytes: number, lang: string): string {
  const units = lang.startsWith("fr") ? ["o", "Ko", "Mo", "Go"] : ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

interface Props {
  sources: readonly ReleaseSource[];
  link: string;
  onLink: (value: string) => void;
  picked: PhonePick | null;
  onPick: () => void;
  onClear: () => void;
  onImportLink: (url: string) => void;
  onImportFiles: () => void;
}

export function ReleaseFormView({ sources, link, onLink, picked, onPick, onClear, onImportLink, onImportFiles }: Props) {
  const { t, i18n } = useTranslation("musicReleases");
  const theme = useTheme();
  const recognized = link.trim() ? recognizeReleaseUrl(link) : null;
  const files = picked?.files ?? [];
  const bytes = files.reduce((sum, f) => sum + f.size, 0);
  const warn = theme.colors.statusPairs.warning.fg;
  return (
    <>
      <Text style={[typography.body, { color: theme.colors.text.secondary }]}>{t("intro")}</Text>
      {sources.includes("bandcamp") ? (
        <View style={styles.group}>
          <Text style={[typography.bodyBold, { color: theme.colors.text.primary }]}>{t("linkLabel")}</Text>
          <TextInput
            value={link}
            onChangeText={onLink}
            editable={files.length === 0}
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="url"
            placeholder={t("linkPlaceholder")}
            placeholderTextColor={theme.colors.text.quaternary}
            accessibilityLabel={t("linkLabel")}
            style={[typography.body, styles.field, { color: theme.colors.text.primary, backgroundColor: theme.colors.fill.subtle, borderColor: theme.colors.border.subtle, opacity: files.length ? 0.5 : 1 }]}
          />
          {link.trim() ? (
            <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: recognized ? theme.colors.text.primary : warn }]}>
              {recognized ? t(recognized.kind === "album" ? "linkRecognizedAlbum" : "linkRecognizedTrack") : t("linkUnknown")}
            </Text>
          ) : null}
        </View>
      ) : null}
      {sources.includes("files") ? (
        <View style={styles.group}>
          <Text style={[typography.bodyBold, { color: theme.colors.text.primary }]}>{t("filesTitle")}</Text>
          <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{t("filesHint")}</Text>
          {files.length > 0 ? (
            <View style={[styles.picked, { backgroundColor: theme.colors.fill.subtle }]}>
              <FileAudio size={18} color={theme.colors.text.tertiary} />
              <Text numberOfLines={1} style={[typography.body, styles.flex, { color: theme.colors.text.primary }]}>
                {t("selected", { count: files.length, size: sizeLabel(bytes, i18n.language) })}
              </Text>
              <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("clear")} style={styles.clear}>
                <X size={18} color={theme.colors.text.tertiary} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={onPick} accessibilityRole="button" style={[styles.choose, { borderColor: theme.colors.border.subtle }]}>
              <Text style={[typography.bodyBold, { color: theme.colors.text.primary }]}>{t("chooseOnPhone")}</Text>
            </Pressable>
          )}
          {picked && picked.ignored > 0 ? <Text style={[typography.caption, { color: warn }]}>{t("ignored", { count: picked.ignored })}</Text> : null}
          {picked?.truncated ? <Text style={[typography.caption, { color: warn }]}>{t("tooMany", { max: RELEASE_FILES_PER_JOB })}</Text> : null}
        </View>
      ) : null}
      <OctavePlayButton
        label={t(files.length ? "importFiles" : "importLink")}
        Icon={null}
        disabled={!files.length && !recognized}
        onPress={() => (files.length ? onImportFiles() : recognized ? onImportLink(recognized.url) : undefined)}
        style={styles.primary}
      />
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  field: { minHeight: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  picked: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderRadius: 12, paddingLeft: 12 },
  flex: { flex: 1, minWidth: 0 },
  clear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  choose: { minHeight: 48, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primary: { marginTop: 4 },
});
