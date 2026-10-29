/**
 * Octave mobile — « Fichiers » : des fichiers audio du téléphone (ou le ZIP d'un album), par le sélecteur du système.
 * Ils entrent dans Octave par la chaîne des sorties, puis dans la playlist, dans l'ordre de leurs albums. La playlist
 * neuve prend le nom saisi, sinon celui de l'album lu, sinon « Import du … » — renommable ensuite.
 */

import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { FileAudio, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { typography, useTheme } from "@/theme";
import { OctavePlayButton } from "../../../layout/OctavePlayButton";
import { showNotice } from "../../../pages";
import { sizeLabel } from "../../../releases/ReleaseFormView";
import { pickPhoneAudio, type PhonePick } from "../../../releases/phoneReleaseFiles";

export function FilesChoice({ into, onStart }: { into: boolean; onStart: (pick: PhonePick, name: string) => void }) {
  const { t, i18n } = useTranslation("musicImport");
  const theme = useTheme();
  const [picked, setPicked] = useState<PhonePick | null>(null);
  const [name, setName] = useState("");
  const files = picked?.files ?? [];
  const bytes = files.reduce((sum, f) => sum + f.size, 0);
  const choose = () => {
    void pickPhoneAudio()
      .then((pick) => pick && setPicked(pick))
      .catch(() => showNotice("error", t("intoFailure.failed"), { title: t("title") }));
  };

  return (
    <>
      <Text style={[typography.body, { color: theme.colors.text.secondary }]}>{t("filesIntro")}</Text>
      {files.length > 0 ? (
        <View style={[styles.picked, { backgroundColor: theme.colors.fill.subtle }]}>
          <FileAudio size={18} color={theme.colors.text.tertiary} />
          <Text numberOfLines={1} style={[typography.body, styles.flex, { color: theme.colors.text.primary }]}>
            {t("filesPicked", { count: files.length, size: sizeLabel(bytes, i18n.language) })}
          </Text>
          <Pressable onPress={() => setPicked(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("filesChange")} style={styles.clear}>
            <X size={18} color={theme.colors.text.tertiary} />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={choose} accessibilityRole="button" style={({ pressed }) => [styles.choose, { borderColor: theme.colors.border.subtle }, pressed && { backgroundColor: theme.colors.fill.soft }]}>
          <Text style={[typography.bodyBold, { color: theme.colors.text.primary }]}>{t("filesChoose")}</Text>
        </Pressable>
      )}
      {picked && picked.ignored > 0 ? <Text style={[typography.caption, { color: theme.colors.statusPairs.warning.fg }]}>{t("filesIgnored", { count: picked.ignored })}</Text> : null}
      {!into ? (
        <View style={styles.nameBlock}>
          <Text style={[typography.caption, { color: theme.colors.text.secondary }]}>{t("nameLabel")}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={200}
            placeholder={t("namePlaceholder")}
            placeholderTextColor={theme.colors.text.quaternary}
            accessibilityLabel={t("nameLabel")}
            style={[typography.body, styles.field, { color: theme.colors.text.primary, backgroundColor: theme.colors.fill.subtle, borderColor: theme.colors.border.subtle }]}
          />
        </View>
      ) : null}
      <OctavePlayButton label={t("filesStart")} Icon={null} onPress={() => picked && files.length > 0 && onStart(picked, name.trim())} disabled={files.length === 0} style={styles.primary} />
    </>
  );
}

const styles = StyleSheet.create({
  picked: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderRadius: 12, paddingHorizontal: 12 },
  clear: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  choose: { minHeight: 52, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, minWidth: 0 },
  nameBlock: { gap: 6 },
  field: { minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  primary: { marginTop: 4 },
});
