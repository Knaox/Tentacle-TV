import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { RADIUS, typography, useThemedStyles, type AppTheme } from "@/theme";
import { formatBytes } from "../formatBytes";

interface Props {
  /** Taille du choix courant (lot : total), `null` si inconnue. */
  sizeBytes: number | null;
  estimate: boolean;
  /** Plus d'un titre : la ligne devient « Total : … ». */
  batch: boolean;
  freeBytes: number | null;
  /** Refus du moteur : demandé (marge comprise) contre disponible. */
  spaceError: { needed: number; free: number } | null;
  /** En données mobiles avec « Wi-Fi seulement » : le transfert attendra. */
  wifiHint: boolean;
  hints: readonly string[];
}

/** Tailles, espace libre, avertissements, et le refus global en cadre rouge. */
export function SizeSummary({ sizeBytes, estimate, batch, freeBytes, spaceError, wifiHint, hints }: Props) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const st = useThemedStyles(makeStyles);
  const sizeText = sizeBytes === null
    ? to("sizeUnknown")
    : batch
      ? to("totalSize", { size: formatBytes(sizeBytes) })
      : estimate
        ? t("estimatedSize", { size: formatBytes(sizeBytes) })
        : t("exactSize", { size: formatBytes(sizeBytes) });

  return (
    <View style={st.wrap}>
      <Text style={st.line}>{sizeText}</Text>
      {freeBytes !== null && <Text style={st.line}>{t("freeSpace", { size: formatBytes(freeBytes) })}</Text>}
      {hints.map((hint) => (
        <Text key={hint} style={st.hint}>{hint}</Text>
      ))}
      {wifiHint && <Text style={st.hint}>{to("wifiOnlyHint")}</Text>}
      {spaceError && (
        <View style={st.errorBox}>
          <Text style={st.errorText}>
            {t("notEnoughSpace", { needed: formatBytes(spaceError.needed), free: formatBytes(spaceError.free) })}
          </Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { gap: 4 },
    line: { ...typography.caption, color: t.colors.text.tertiary },
    hint: { ...typography.caption, color: t.colors.statusPairs.warning.fg, lineHeight: 17, marginTop: 2 },
    errorBox: {
      marginTop: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      backgroundColor: t.colors.statusPairs.error.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.status.error,
    },
    errorText: { ...typography.caption, color: t.colors.statusPairs.error.fg, lineHeight: 17 },
  });
