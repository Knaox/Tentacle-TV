import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { MY_TITLE_PERCENT_KEY } from "@tentacle-tv/shared";
import { colors, fonts } from "../theme/tokens";
import type { ArrivalState } from "./arrivalTypes";
import type { RequestItemModel } from "./requestTypes";

/**
 * Où en est une demande, en une ligne : le mot, et pour un titre qui arrive
 * son avancement À L'INSTANT — le même que le camembert de son affiche
 * (`percent`, projeté par la ligne). Le signe de l'état est sur l'affiche, au
 * centre (`ArrivalSign`) : jamais la couleur seule, chaque état a son signe ET
 * son mot.
 */

const COLOR: Record<ArrivalState, string> = {
  pending: colors.textSecondary,
  arriving: colors.text,
  importing: colors.accentLight,
  blocked: colors.warningFg,
  arrived: colors.successFg,
};

export const RequestStateLine = memo(function RequestStateLine({ item, percent }: { item: RequestItemModel; percent: number | null }) {
  const { t } = useTranslation();
  const state = item.arrival.state;
  const value = state === "arriving" && percent !== null ? t(MY_TITLE_PERCENT_KEY, { percent: Math.floor(percent) }) : null;
  return (
    <View style={styles.line}>
      <Text style={[styles.word, { color: COLOR[state] }]} numberOfLines={1}>
        {item.stateLabel}
      </Text>
      {value ? <Text style={styles.percent}>{value}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: 12 },
  word: { ...fonts.semibold, fontSize: 26 },
  percent: { ...fonts.semibold, fontSize: 26, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
});
