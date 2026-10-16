import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { MANAGE_SHEET_GROUP } from "@tentacle-tv/tv-core";
import { FocusSection } from "../../focus/FocusSection";
import { colors, fonts, text } from "../../theme/tokens";
import { ToggleRow } from "../settings/ToggleRow";
import type { ManageSheetView } from "./manageTypes";
import { ProfileAvatar } from "./ProfileAvatar";
import { SheetRow } from "./SheetRow";

/**
 * La FICHE d'un profil dans « Gérer les profils » (TV) : à gauche qui il est
 * (portrait, nom, rôle), à droite ce que la session peut y faire, une ligne
 * par geste, de haut en bas — la photo, le code PIN, les réglages oui/non
 * (« Peut demander des films », « Parent », « Peut créer des invités »), le
 * contrôle parental, puis, à part et en rouge, le geste qui retire (à double
 * appui : armé, la ligne dit ce qui va se passer). Sous les lignes, ce que le
 * dernier geste a donné.
 *
 * Clés : celles des lignes (tv-core `manageSheetKey`) ; groupe `manage:sheet`.
 */
export const ProfileSheet = memo(function ProfileSheet({ sheet, onRow, onRowBlur }: {
  sheet: ManageSheetView;
  onRow?: (key: string) => void;
  onRowBlur?: (key: string) => void;
}) {
  const { t } = useTranslation("preferences");
  return (
    <View style={styles.layout}>
      <View style={styles.identity}>
        <ProfileAvatar name={sheet.name} color={sheet.color} uri={sheet.avatarUri} size={AVATAR} />
        <Text style={styles.name} numberOfLines={2}>{sheet.name}</Text>
        <Text style={styles.detail} numberOfLines={2}>{sheet.detail}</Text>
      </View>
      <View style={styles.side}>
        <FocusSection focusKey={MANAGE_SHEET_GROUP} list style={styles.rows}>
          {sheet.rows.map((row) =>
            row.kind === "toggle" ? (
              <ToggleRow
                key={row.key}
                icon={row.icon}
                title={row.title}
                description={row.description}
                value={row.value === true}
                onLabel={t("reglageActive")}
                offLabel={t("reglageDesactive")}
                focusKey={row.key}
                onToggle={onRow ? () => onRow(row.key) : undefined}
              />
            ) : (
              <View key={row.key} style={row.tone === "danger" ? styles.danger : null}>
                <SheetRow
                  icon={row.icon}
                  title={row.title}
                  description={row.description}
                  state={row.state}
                  opens={row.opens}
                  tone={row.tone}
                  armed={row.armed}
                  focusKey={row.key}
                  onPress={onRow ? () => onRow(row.key) : undefined}
                  onFocusChange={(focused) => {
                    if (!focused) onRowBlur?.(row.key);
                  }}
                />
              </View>
            ),
          )}
        </FocusSection>
        <View style={styles.footer}>
          {sheet.notice ? (
            <Text style={[styles.notice, { color: sheet.notice.tone === "error" ? colors.warningFg : colors.successFg }]}>{sheet.notice.text}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const AVATAR = 200;

const styles = StyleSheet.create({
  layout: { flexDirection: "row", gap: 64, alignItems: "flex-start" },
  identity: { width: 320, alignItems: "flex-start", gap: 14, paddingTop: 8 },
  name: { ...text.title, fontSize: 52, lineHeight: 60, marginTop: 14 },
  detail: { ...fonts.medium, fontSize: 26, lineHeight: 34, color: colors.textSecondary },
  side: { flex: 1, maxWidth: 1080 },
  rows: { gap: 12 },
  danger: { marginTop: 18 },
  footer: { minHeight: 56, justifyContent: "center", marginTop: 12 },
  notice: { ...fonts.semibold, fontSize: 26, lineHeight: 34 },
});
