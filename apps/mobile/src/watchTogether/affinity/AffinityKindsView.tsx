import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight, Clapperboard, HeartHandshake, Sparkles, Tv, X, type LucideIcon } from "lucide-react-native";
import { WtApiError, fetchAffinityKinds, startAffinity, type AffinityKinds } from "@tentacle-tv/api-client";
import type { WtAffinityKind, WtAffinityStateDto } from "@tentacle-tv/shared";
import { SecondaryButton } from "@/components/ui/buttons";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { AFFINITY_KINDS, KIND_LABEL_KEY } from "@tentacle-tv/api-client";

const ICONS: Record<WtAffinityKind, LucideIcon> = { movie: Clapperboard, series: Tv, anime: Sparkles };

/**
 * Le choix du type — films, séries ou animés, chacun avec le nombre de titres
 * que TOUT le groupe peut lire (un type sans titre commun ne se choisit pas).
 * Choisir lance l'affinité chez tout le groupe ; en séance, c'est un
 * changement de type, et il se dit. Les refus se disent ici, en mots.
 * Même règle que le web (`AffinityKindsView`).
 */
export function AffinityKindsView({ state, onStarted, onBack, onClose }: {
  state: WtAffinityStateDto | null;
  onStarted: (state: WtAffinityStateDto) => void;
  /** En séance : revenir à la pile. */
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("watchTogether");
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const [kinds, setKinds] = useState<AffinityKinds | null>(null);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<WtAffinityKind | null>(null);
  const switching = state !== null;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetchAffinityKinds()
      .then((k) => { if (!cancelled) setKinds(k); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailed(true);
        if (err instanceof WtApiError && err.status === 404 && !err.code) setProblem(t("affinityServerTooOld"));
      });
    return () => { cancelled = true; };
  }, [attempt, t]);

  const pick = (kind: WtAffinityKind): void => {
    setBusy(kind);
    setProblem(null);
    startAffinity(kind).then(
      (next) => { setBusy(null); onStarted(next); },
      (err: unknown) => {
        setBusy(null);
        const code = err instanceof WtApiError ? err.code : undefined;
        if (code === "empty_catalog") setKinds((k) => (k ? { ...k, counts: { ...k.counts, [kind]: 0 } } : k));
        else setProblem(t(code === "need_two_members" ? "affinityNeedTwo" : "errorGeneric"));
      },
    );
  };

  return (
    <ScrollView contentContainerStyle={s.content} testID="wt-affinity-kinds">
      <View style={s.header}>
        {switching ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t("back")} style={s.iconButton}>
            <ArrowLeft size={22} color={theme.colors.text.secondary} />
          </Pressable>
        ) : (
          <View style={s.badge}><HeartHandshake size={22} color="#ffffff" /></View>
        )}
        <View style={s.headerText}>
          <Text style={s.title} accessibilityRole="header">{switching ? t("affinityChooseKind") : t("affinityFind")}</Text>
          <Text style={s.hint}>{switching ? t("affinitySwitchWarning") : t("affinityFindHint")}</Text>
        </View>
        {!switching && (
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t("close")} style={s.iconButton}>
            <X size={22} color={theme.colors.text.tertiary} />
          </Pressable>
        )}
      </View>

      {failed ? (
        <View style={s.errorBox} accessibilityRole="alert">
          <Text style={s.hint}>{t("affinityKindsError")}</Text>
          <SecondaryButton label={t("affinityRetry")} onPress={() => setAttempt((n) => n + 1)} size="sm" />
        </View>
      ) : (
        AFFINITY_KINDS.map((kind) => {
          const Icon = ICONS[kind];
          const count = kinds?.counts[kind];
          const current = state?.kind === kind;
          const resumable = !current && !!kinds?.resume.includes(kind);
          const detail = busy === kind ? t("affinityPreparing")
            : count === undefined ? t("affinityCounting")
            : count === 0 ? t("affinityKindNone") : t("affinityKindCount", { count });
          const disabled = !count || busy !== null;
          return (
            <Pressable
              key={kind}
              onPress={() => pick(kind)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled, busy: busy === kind }}
              accessibilityLabel={`${t(KIND_LABEL_KEY[kind])}, ${detail}`}
              style={({ pressed }) => [s.kind, pressed && s.pressed, disabled && s.disabled]}
              testID={`wt-affinity-kind-${kind}`}
            >
              <View style={s.kindIcon}><Icon size={22} color={theme.colors.brand.light} /></View>
              <View style={s.headerText}>
                <Text style={s.kindLabel}>{t(KIND_LABEL_KEY[kind])}</Text>
                <Text style={s.kindDetail}>{detail}</Text>
              </View>
              {busy === kind && <ActivityIndicator size="small" color={theme.colors.brand.light} />}
              {(current || resumable) && <Text style={s.chip}>{t(current ? "affinityCurrent" : "affinityResume")}</Text>}
              <ChevronRight size={18} color={theme.colors.text.quaternary} />
            </Pressable>
          );
        })
      )}
      {problem && <Text style={s.problem} accessibilityRole="alert">{problem}</Text>}
      <Text style={s.small}>{t("affinityScope")}</Text>
      <Text style={s.small}>{t("affinityPrivate")}</Text>
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  content: { padding: 20, gap: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  headerText: { flex: 1, minWidth: 0 },
  badge: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.brand.violet },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { color: t.colors.text.primary, fontSize: 20, fontFamily: FONT_FAMILY.bold },
  hint: { marginTop: 2, color: t.colors.text.tertiary, fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular },
  kind: {
    flexDirection: "row", alignItems: "center", gap: 14, minHeight: 68, paddingHorizontal: 14,
    borderRadius: RADIUS.xl, backgroundColor: t.colors.fill.faint, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
  },
  pressed: { backgroundColor: t.colors.fill.soft },
  disabled: { opacity: 0.5 },
  kindIcon: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.brand.ghost },
  kindLabel: { color: t.colors.text.primary, fontSize: 16, fontFamily: FONT_FAMILY.semibold },
  kindDetail: { color: t.colors.text.tertiary, fontSize: 13, fontFamily: FONT_FAMILY.regular, fontVariant: ["tabular-nums"] },
  chip: {
    overflow: "hidden", paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill,
    backgroundColor: t.colors.fill.soft, color: t.colors.text.secondary, fontSize: 11, fontFamily: FONT_FAMILY.semibold,
  },
  errorBox: { padding: 16, alignItems: "center", gap: 12, borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle },
  problem: { color: t.colors.status.error, fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILY.regular },
  small: { color: t.colors.text.tertiary, fontSize: 12, lineHeight: 17, fontFamily: FONT_FAMILY.regular },
});
