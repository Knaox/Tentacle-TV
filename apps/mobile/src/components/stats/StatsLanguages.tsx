import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Headphones } from "lucide-react-native";
import { LISTENING_VERSIONS, listeningHeadline, listeningState, type ViewingStats } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { HBarList, type HBarItem } from "./HBarList";
import { StatsBlock } from "./StatsBlock";
import { useStatsFormat, type StatsFormat } from "./useStatsFormat";

/** Sous 1 %, « autres » ou « inconnue » ne valent pas une ligne. */
const REMAINDER_MIN = 0.01;

function remainder(f: StatsFormat, key: string, label: string, share: number, base: number): HBarItem | null {
  if (share < REMAINDER_MIN) return null;
  return { key, label, value: share, display: f.percent(share), secondary: f.duration(share * base), muted: true };
}

/**
 * « Origine des titres » — le pays où ils ont été produits, pondéré par le
 * temps passé : d'où VIENT ce qu'on regarde, pas ce qu'on entend. Les autres
 * pays et l'origine inconnue ferment la liste, en neutre (cf. le web).
 */
export const OriginsBlock = memo(function OriginsBlock({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const { countries, otherShare, unknownShare } = stats.origins;
  if (countries.length === 0) return null;
  const total = stats.totals.seconds;
  const items: HBarItem[] = countries.map((c) => ({
    key: c.key, label: c.label, value: c.share, display: f.percent(c.share), secondary: f.duration(c.seconds),
  }));
  for (const extra of [
    remainder(f, "other", f.t("originsOther"), otherShare, total),
    remainder(f, "unknown", f.t("originsUnknown"), unknownShare, total),
  ]) if (extra) items.push(extra);
  return (
    <StatsBlock title={f.t("originsTitle")} hint={f.t("originsHint")}>
      <HBarList max={1} items={items} />
    </StatsBlock>
  );
});

/**
 * « VF ou VO ? » — d'après la piste audio LUE, relevée depuis `since` : la
 * version qui domine, la part de chacune, puis les langues entendues, avec
 * leur base. Tant que l'échantillon est trop mince, un mot dit depuis quand
 * la mesure court — jamais un pourcentage tiré de trois séances.
 */
export const ListeningBlock = memo(function ListeningBlock({ stats }: { stats: ViewingStats }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const l = stats.listening;
  const state = listeningState(l);
  if (state === "hidden") return null;
  const since = l.since ? f.isoDay(l.since, true) : "";

  if (state === "pending") {
    return (
      <StatsBlock title={f.t("listeningTitle")} hint={f.t("listeningHint")}>
        <View style={st.pending}>
          <Headphones size={18} color={theme.colors.brand.light} strokeWidth={2} />
          <Text style={st.pendingTxt}>{f.t("listeningPending", { date: since })}</Text>
        </View>
      </StatsBlock>
    );
  }

  const headline = listeningHeadline(l);
  const versions = l.versions;
  const languages: HBarItem[] = l.languages.map((lang) => ({
    key: lang.key, label: lang.label, value: lang.share, display: f.percent(lang.share), secondary: f.duration(lang.seconds),
  }));
  const other = remainder(f, "other", f.t("listeningOther"), l.otherShare, l.knownSeconds);
  if (other) languages.push(other);
  const base = f.t("listeningBase", { date: since, duration: f.duration(l.knownSeconds) });
  const versionBase = versions && l.knownSeconds - l.versionSeconds >= 60
    ? ` ${f.t("listeningVersionBase", { duration: f.duration(l.versionSeconds) })}`
    : "";

  return (
    <StatsBlock title={f.t("listeningTitle")} hint={f.t("listeningHint")}>
      {headline && versions ? (
        <View>
          <Text style={st.headline}>{f.t(`listeningHeadline_${headline.version}`)}</Text>
          <Text style={st.headlineShare}>{f.t("listeningHeadlineShare", { share: f.percent(headline.share) })}</Text>
          <HBarList
            max={1}
            items={LISTENING_VERSIONS.filter((v) => versions[v] > 0).map((v) => ({
              key: v, label: f.t(`version_${v}`), value: versions[v], display: f.percent(versions[v]), secondary: f.duration(versions[v] * l.versionSeconds),
            }))}
          />
        </View>
      ) : null}
      {languages.length > 0 ? (
        <View style={headline ? st.divided : undefined}>
          <Text style={st.sub}>{f.t("listeningLanguages")}</Text>
          <HBarList max={1} items={languages} />
        </View>
      ) : null}
      <Text style={st.base}>{`${base}${versionBase}`}</Text>
    </StatsBlock>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    pending: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: RADIUS.lg,
      backgroundColor: t.colors.fill.faint,
    },
    pendingTxt: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    headline: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    headlineShare: { marginTop: 2, marginBottom: spacing.md, fontSize: 13, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    divided: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle },
    sub: { marginBottom: spacing.md, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    base: { marginTop: spacing.lg, fontSize: 12, lineHeight: 17, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
