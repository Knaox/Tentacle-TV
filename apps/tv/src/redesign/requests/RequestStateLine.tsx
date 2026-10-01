import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ProgressPie } from "../brand/ProgressPie";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts } from "../theme/tokens";
import type { RequestItemModel, RequestStateKind } from "./requestTypes";

/**
 * Où en est une demande, en une ligne : un signe, le mot, et pour un titre
 * qui arrive son avancement — le camembert de la marque et le pour cent.
 * Jamais la couleur seule : chaque état a son signe ET son mot.
 */

const GLYPH = 32;

const SIGNS: Record<Exclude<RequestStateKind, "arriving">, { icon: IconName; color: string }> = {
  pending: { icon: "clock", color: colors.textSecondary },
  importing: { icon: "inboxIn", color: colors.accentLight },
  blocked: { icon: "alert", color: colors.warningFg },
};

export const RequestStateLine = memo(function RequestStateLine({ item }: { item: RequestItemModel }) {
  const arriving = item.state === "arriving";
  const sign = item.state === "arriving" ? null : SIGNS[item.state];
  return (
    <View style={styles.line}>
      <View style={styles.glyph}>
        {arriving ? <ProgressPie percent={item.percent} size={GLYPH} showValue={false} /> : null}
        {sign ? <Icon name={sign.icon} size={GLYPH - 4} color={sign.color} /> : null}
      </View>
      <Text style={[styles.word, { color: sign?.color ?? colors.text }]} numberOfLines={1}>
        {item.stateLabel}
      </Text>
      {arriving && item.percentLabel ? <Text style={styles.percent}>{item.percentLabel}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: 12 },
  glyph: { width: GLYPH, height: GLYPH, alignItems: "center", justifyContent: "center" },
  word: { ...fonts.semibold, fontSize: 26 },
  percent: { ...fonts.semibold, fontSize: 26, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
});
