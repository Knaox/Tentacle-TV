import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRequestTitleSeasons, useSeasons, useTitleSeasons } from "@tentacle-tv/api-client";
import { librarySeasonNumbers, seasonPick, type TitleKey } from "@tentacle-tv/shared";
import { BottomSheet } from "@/components/ui";
import { useTitleProvider } from "@/components/external/useExternalTitle";
import { FONT_FAMILY, RADIUS, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { SeasonSheetRows } from "./SeasonSheetRows";

/** La série dont on demande les saisons. */
export interface SeasonRequestTarget {
  /** La série dans la bibliothèque : ses saisons présentes ne se cochent pas. */
  seriesId: string;
  /** Sa clé TMDB, celle que l'extension connaît. */
  key: TitleKey;
  name: string;
}

/**
 * La feuille des saisons à demander d'une série de la bibliothèque, au
 * téléphone : une ligne par saison dans l'ordre de l'extension
 * (`titles.seasons`, modèle `seasonPick`) — celles qu'on a disent « Dans la
 * bibliothèque », celles déjà demandées leur état, les autres se cochent.
 * « Demander N saisons » au dégradé ; la réponse de l'extension se dit SUR
 * PLACE, comme sur la feuille des cartes hors bibliothèque (pas de toast au
 * téléphone), et les saisons se relisent.
 */
export function SeasonRequestSheet({ target, onClose }: { target: SeasonRequestTarget | null; onClose: () => void }) {
  // La feuille descend encore un instant après sa fermeture : elle garde sa série.
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (target) setShown(target);
  }, [target]);
  const body = target ?? shown;
  return (
    <BottomSheet visible={target !== null} onClose={onClose} snapPoints={[0.62, 0.9]}>
      {body && <SheetBody key={body.key} target={body} />}
    </BottomSheet>
  );
}

function SheetBody({ target }: { target: SeasonRequestTarget }) {
  const { t } = useTranslation("requests");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { provider, lang } = useTitleProvider();
  const { answer, failed } = useTitleSeasons(provider, target.key, lang);
  // Ce que la bibliothèque a : attendu avant de proposer quoi que ce soit à cocher.
  const library = useSeasons(target.seriesId);
  const owned = useMemo(() => librarySeasonNumbers(library.data ?? []), [library.data]);
  const known = library.data !== undefined || library.isError;
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set());
  const pick = useMemo(
    () => seasonPick(t, known ? answer : null, failed, checked, owned),
    [t, known, answer, failed, checked, owned],
  );
  const request = useRequestTitleSeasons(provider, lang);
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  const onToggle = useCallback((number: number) => {
    setOutcome(null);
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  }, []);

  const submit = () => {
    if (pick.chosen.length === 0 || request.isPending) return;
    setOutcome(null);
    request.mutate({ key: target.key, seasons: pick.chosen }, {
      onSuccess: (res) => {
        const ok = res.kind === "done" && res.ok;
        const message = res.kind === "done" ? res.message : null;
        setOutcome({ ok, message: message ?? t(ok ? "cards:requestSent" : "cards:requestFailed") });
        // Parties : les saisons se relisent (`useRequestTitleSeasons`), plus rien n'est coché.
        if (ok) setChecked(new Set());
      },
      onError: () => setOutcome({ ok: false, message: t("cards:requestFailed") }),
    });
  };

  const disabled = pick.chosen.length === 0 || request.isPending;
  const fg = theme.colors.cta.brandFg;
  return (
    <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
      <Text style={st.title} numberOfLines={2} accessibilityRole="header">{target.name}</Text>
      <Text style={st.subtitle}>{t("seasonsSubtitle")}</Text>
      {pick.message ? <Text style={st.message}>{pick.message}</Text> : null}
      {pick.rows && pick.rows.length > 0 ? <SeasonSheetRows rows={pick.rows} onToggle={onToggle} /> : null}
      {outcome ? (
        <Text
          style={[st.outcome, { color: outcome.ok ? theme.colors.brand.light : theme.colors.status.error }]}
          accessibilityRole={outcome.ok ? "text" : "alert"}
        >
          {outcome.message}
        </Text>
      ) : null}
      <Pressable
        onPress={submit}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: request.isPending }}
        accessibilityLabel={`${pick.submitLabel ?? t("seasonsSubmitIdle")} — ${target.name}`}
        style={({ pressed }) => [st.ctaWrap, disabled && st.ctaDisabled, pressed && !disabled && { opacity: 0.86 }]}
      >
        <LinearGradient
          colors={[theme.colors.brand.violet, theme.colors.brand.accent]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={st.cta}
        >
          <View style={st.ctaIcon}>
            {request.isPending ? <ActivityIndicator size="small" color={fg} /> : <Feather name="plus" size={18} color={fg} />}
          </View>
          <Text style={[st.ctaText, { color: fg }]} numberOfLines={1}>{pick.submitLabel ?? t("seasonsSubmitIdle")}</Text>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    body: { paddingBottom: spacing.xl },
    title: { fontSize: 18, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, letterSpacing: -0.2, marginHorizontal: spacing.lg, marginTop: spacing.sm },
    subtitle: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginHorizontal: spacing.lg, marginTop: 4, marginBottom: spacing.md },
    message: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
    outcome: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, marginHorizontal: spacing.lg, marginTop: spacing.md, textAlign: "center" as const },
    ctaWrap: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: RADIUS.pill, overflow: "hidden" as const },
    ctaDisabled: { opacity: 0.45 },
    cta: { minHeight: 52, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: spacing.sm, paddingHorizontal: spacing.lg },
    ctaIcon: { width: 20, height: 20, alignItems: "center" as const, justifyContent: "center" as const },
    ctaText: { fontSize: 16, fontFamily: FONT_FAMILY.bold },
  });
