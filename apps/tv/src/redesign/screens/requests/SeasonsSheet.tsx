import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { MY_TITLE_PERCENT_KEY } from "@tentacle-tv/shared";
import { Icon, type IconName } from "../../icons/Icon";
import { ArrivalSign } from "../../requests/ArrivalSign";
import type { ArrivalModel, ArrivalState } from "../../requests/arrivalTypes";
import { useArrivalPercent } from "../../requests/useArrivalPercent";
import { colors, fonts, white } from "../../theme/tokens";
import { FilterSheet } from "../library/FilterSheet";
import { OPTION_ROW_HEIGHT, OptionRow } from "../library/OptionRow";

/**
 * La feuille des SAISONS d'une série à demander : la grande liste en
 * surimpression des filtres (`FilterSheet`), une ligne par saison. Celles qui
 * se demandent encore se cochent (`OptionRow`, le nombre d'épisodes à
 * droite) ; les autres disent où elles en sont (« Disponible », « Demandée »)
 * et ne prennent pas le focus — celles de la demande du compte, son camembert
 * et son avancement à l'instant (`status.arrival`). En bas, « Demander N saisons » au dégradé de la
 * marque dès qu'une saison est cochée — avant, « Fermer », en verre.
 *
 * Vue pure. Clés de focus : `sheet:season:<numéro>`, puis `sheet:apply`
 * (groupe `sheet:footer`).
 */

export type SeasonStatusTone = "pending" | "ready" | "neutral";

export interface SeasonRowModel {
  number: number;
  /** « Saison 1 », « Épisodes spéciaux ». */
  label: string;
  /** « 10 épisodes ». */
  detail?: string;
  /** Pas à cocher : où elle en est — et, saison de la demande du compte, son arrivée. */
  status?: { label: string; tone: SeasonStatusTone; arrival?: ArrivalModel };
  selected: boolean;
}

export interface SeasonsSheetModel {
  /** Le nom de la série. */
  title: string;
  /** « Cochez les saisons à demander. » */
  subtitle: string;
  /** `null` : elles se lisent encore. */
  seasons: SeasonRowModel[] | null;
  /** À la place des saisons : leur lecture, un échec, ou rien à demander. */
  message?: string;
  /** La pilule du pied : « Demander 2 saisons » dès qu'une saison est cochée,
   *  sinon « Fermer » — jamais un bouton qui ne ferait rien. */
  submit: { label: string; kind: "request" | "close" };
}

export const seasonFocusKey = (number: number) => `sheet:season:${number}`;

const WIDTH = 900;
const INNER = WIDTH - 96;
const ROW_GAP = 10;
const VISIBLE_ROWS = 6;

const STATUS: Record<SeasonStatusTone, { color: string; icon: IconName }> = {
  pending: { color: colors.accentLight, icon: "clock" },
  ready: { color: colors.successFg, icon: "check" },
  neutral: { color: colors.textTertiary, icon: "lock" },
};

const ARRIVAL_COLOR: Record<ArrivalState, string> = {
  pending: colors.accentLight,
  arriving: colors.text,
  importing: colors.accentLight,
  blocked: colors.warningFg,
  arrived: colors.successFg,
};

/** Une saison de la demande du compte : son camembert, son mot, son avancement à l'instant. */
function ArrivingRow({ row, arrival, label }: { row: SeasonRowModel; arrival: ArrivalModel; label: string }) {
  const { t } = useTranslation();
  const percent = useArrivalPercent(arrival);
  const value = arrival.state === "arriving" && percent !== null ? t(MY_TITLE_PERCENT_KEY, { percent: Math.floor(percent) }) : null;
  return (
    <View style={styles.settled}>
      <ArrivalSign state={arrival.state} percent={percent} size={28} disc={false} />
      <Text style={styles.settledLabel} numberOfLines={1}>{row.label}</Text>
      <Text style={[styles.settledStatus, styles.tabular, { color: ARRIVAL_COLOR[arrival.state] }]}>{value ? `${label} · ${value}` : label}</Text>
    </View>
  );
}

/** Une saison qui ne se coche pas : son nom, et où elle en est. */
function SettledRow({ row }: { row: SeasonRowModel }) {
  if (row.status?.arrival) return <ArrivingRow row={row} arrival={row.status.arrival} label={row.status.label} />;
  const status = row.status ? STATUS[row.status.tone] : STATUS.neutral;
  return (
    <View style={styles.settled}>
      <Icon name={status.icon} size={26} color={status.color} strokeWidth={2.4} />
      <Text style={styles.settledLabel} numberOfLines={1}>{row.label}</Text>
      {row.status ? <Text style={[styles.settledStatus, { color: status.color }]}>{row.status.label}</Text> : null}
    </View>
  );
}

export const SeasonsSheet = memo(function SeasonsSheet({
  sheet,
  onToggle,
  onSubmit,
  onClose,
}: {
  sheet: SeasonsSheetModel;
  onToggle?: (number: number) => void;
  onSubmit?: () => void;
  onClose?: () => void;
}) {
  const request = sheet.submit.kind === "request";
  const seasons = sheet.seasons ?? [];
  const scrolls = seasons.length > VISIBLE_ROWS;
  const height = VISIBLE_ROWS * OPTION_ROW_HEIGHT + (VISIBLE_ROWS - 1) * ROW_GAP;
  const list = (
    <View style={styles.list}>
      {seasons.map((row) =>
        row.status ? (
          <SettledRow key={row.number} row={row} />
        ) : (
          <OptionRow
            key={row.number}
            label={row.label}
            detail={row.detail}
            selected={row.selected}
            mode="check"
            width={INNER}
            focusKey={seasonFocusKey(row.number)}
            onPress={onToggle ? () => onToggle(row.number) : undefined}
          />
        ),
      )}
    </View>
  );
  return (
    <FilterSheet
      title={sheet.title}
      subtitle={sheet.subtitle}
      width={WIDTH}
      applyLabel={sheet.submit.label}
      applyVariant={request ? "brand" : "glass"}
      applyIcon={request ? "check" : "close"}
      onApply={request ? onSubmit : onClose}
    >
      {sheet.message ? <Text style={styles.message}>{sheet.message}</Text> : null}
      {seasons.length === 0 ? null : scrolls ? (
        // Le débord laisse la place à l'agrandissement de la ligne focalisée.
        <ScrollView style={[styles.scroll, { height }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {list}
        </ScrollView>
      ) : (
        list
      )}
    </FilterSheet>
  );
});

const styles = StyleSheet.create({
  list: { gap: ROW_GAP },
  scroll: { marginHorizontal: -12 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 2 },
  message: { ...fonts.medium, fontSize: 26, lineHeight: 36, color: colors.textSecondary },
  settled: {
    height: OPTION_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: white(0.04),
  },
  settledLabel: { ...fonts.medium, fontSize: 28, color: white(0.6), flexShrink: 1, flexGrow: 1 },
  settledStatus: { ...fonts.semibold, fontSize: 24 },
  tabular: { fontVariant: ["tabular-nums"] },
});
