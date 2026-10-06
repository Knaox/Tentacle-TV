import { useCallback, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { FONT_FAMILY, RADIUS, useThemedStyles, useTheme, withAlpha, type AppTheme } from "../../theme";
import { GlassCard } from "../ui";
import { ProblemState } from "../problems/ProblemState";
import { usePageProblem } from "../problems/usePageProblem";
import { usePairingAvailability } from "../../hooks/usePairingAvailability";
import { PairCodeInputs, type PairCodeInputsHandle } from "./PairCodeInputs";
import { PairUnavailableCard } from "./PairUnavailableCard";
import { usePairTvFlow } from "./usePairTvFlow";

interface Props {
  /** Une fois la TV jumelée, offrir d'en jumeler une autre sans quitter l'écran. */
  allowAnother?: boolean;
}

/**
 * La carte du jumelage d'une TV : les quatre cases du code, validées au
 * dernier caractère, puis le succès ou l'erreur — avec, chaque fois, de quoi
 * repartir. La même dans l'écran `/pair-tv` et en tête d'« Appareils et TV ».
 * Le jumelage exige l'URL publique du serveur ; une panne se dit à part.
 */
export function PairTvCard({ allowAnother = false }: Props) {
  const { t } = useTranslation("pairing");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { storage } = useTentacleConfig();
  const { chars, setChars, status, errorMsg, canSubmit, submit, reset } = usePairTvFlow(storage);
  const codeInputsRef = useRef<PairCodeInputsHandle>(null);

  const pairing = usePairingAvailability(storage);
  const { available } = pairing;
  const pairingFailure = usePageProblem(pairing.error, {
    target: "tentacle", context: "pairing", availability: { canGoBack: false }, onRetry: pairing.retry,
  });

  const handleReset = useCallback(() => {
    reset();
    // Le temps que les cases réapparaissent (après un succès, elles étaient démontées).
    requestAnimationFrame(() => codeInputsRef.current?.focusFirst());
  }, [reset]);

  let body;
  if (pairingFailure.model) {
    body = <ProblemState embedded model={pairingFailure.model} onAction={pairingFailure.onAction} />;
  } else if (available !== true) {
    body = <PairUnavailableCard loading={available === null} />;
  } else if (status === "success") {
    body = (
      <View style={st.success} accessibilityLiveRegion="polite">
        <View style={st.successBadge}>
          <Feather name="check-circle" size={40} color={theme.colors.status.success} />
        </View>
        <Text style={st.successText}>{t("tvPairedSuccess")}</Text>
        {allowAnother ? (
          <Pressable
            onPress={handleReset}
            accessibilityRole="button"
            accessibilityLabel={t("pairAnotherTv")}
            style={({ pressed }) => [st.secondary, st.another, pressed && st.pressed]}
          >
            <Text style={st.secondaryText}>{t("pairAnotherTv")}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  } else {
    body = (
      <>
        <PairCodeInputs ref={codeInputsRef} chars={chars} onChange={setChars} status={status} />
        {status === "error" && errorMsg ? (
          <View style={st.errorRow} accessibilityLiveRegion="polite">
            <Feather name="alert-circle" size={16} color={theme.colors.status.error} />
            <Text style={st.errorText}>{errorMsg}</Text>
          </View>
        ) : null}
        {status === "error" ? (
          <Pressable
            onPress={handleReset}
            accessibilityRole="button"
            accessibilityLabel={t("common:retry")}
            style={({ pressed }) => [st.secondary, pressed && st.pressed]}
          >
            <Text style={st.secondaryText}>{t("common:retry")}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={t("pairTV")}
            accessibilityState={{ disabled: !canSubmit, busy: status === "pairing" }}
            style={({ pressed }) => [st.primary, !canSubmit && st.primaryOff, canSubmit && pressed && st.pressed]}
          >
            {status === "pairing" ? (
              <ActivityIndicator color={theme.colors.cta.primaryFg} size="small" />
            ) : (
              <Text style={st.primaryText}>{t("pairTV")}</Text>
            )}
          </Pressable>
        )}
      </>
    );
  }

  return <GlassCard style={st.card}>{body}</GlassCard>;
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  card: { padding: 24 },
  success: { alignItems: "center" as const, paddingVertical: 12 },
  successBadge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: t.colors.statusPairs.success.bg,
    justifyContent: "center" as const, alignItems: "center" as const, marginBottom: 14,
  },
  successText: { color: t.colors.status.success, fontSize: 16, fontFamily: FONT_FAMILY.semibold, textAlign: "center" as const },
  another: { alignSelf: "stretch" as const, marginTop: 20 },
  errorRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, marginBottom: 14 },
  errorText: { color: t.colors.status.error, fontSize: 13, fontFamily: FONT_FAMILY.medium, textAlign: "center" as const, flexShrink: 1 },
  secondary: {
    backgroundColor: t.colors.brand.ghost,
    borderWidth: 1,
    borderColor: withAlpha(t.colors.brand.violet, 0.4, t.colors.brand.glow),
    borderRadius: RADIUS.md, paddingVertical: 13, minHeight: 46,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  secondaryText: { color: t.colors.text.primary, fontSize: 15, fontFamily: FONT_FAMILY.semibold },
  primary: {
    backgroundColor: t.colors.cta.primaryBg,
    borderRadius: RADIUS.md, paddingVertical: 13, minHeight: 46,
    alignItems: "center" as const, justifyContent: "center" as const,
    shadowColor: t.colors.brand.violet, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55, shadowRadius: 22, elevation: 12,
  },
  primaryOff: { opacity: 0.45, shadowOpacity: 0 },
  primaryText: { color: t.colors.cta.primaryFg, fontSize: 15, fontFamily: FONT_FAMILY.bold, letterSpacing: 0.2 },
  pressed: { opacity: 0.88 },
});
