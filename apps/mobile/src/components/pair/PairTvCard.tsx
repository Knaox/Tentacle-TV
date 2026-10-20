import { useCallback, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { FONT_FAMILY, useThemedStyles, useTheme, type AppTheme } from "../../theme";
import { GlassCard } from "../ui";
import { PrimaryButton, SecondaryButton } from "../ui/buttons";
import { ProblemState } from "../problems/ProblemState";
import { usePageProblem } from "../problems/usePageProblem";
import { usePairingAvailability } from "../../hooks/usePairingAvailability";
import { PairCodeInputs, type PairCodeInputsHandle } from "./PairCodeInputs";
import { PairUnavailableCard } from "./PairUnavailableCard";
import { usePairTvFlow } from "./usePairTvFlow";

interface Props {
  /** Une fois la TV jumelée, offrir d'en jumeler une autre sans quitter l'écran. */
  allowAnother?: boolean;
  /** Ouvrir le clavier sur la première case dès l'arrivée (l'écran `/pair-tv`). */
  autoFocus?: boolean;
}

/**
 * La carte du jumelage d'une TV : les quatre cases du code, validées au
 * dernier caractère, puis le succès ou l'erreur — avec, chaque fois, de quoi
 * repartir. La même dans l'écran `/pair-tv` et en tête d'« Appareils et TV ».
 * Le jumelage exige une adresse du serveur qu'une TV puisse joindre (l'annoncée,
 * sinon celle de ce téléphone — `usePairingAvailability`) ; une panne se dit à part.
 */
export function PairTvCard({ allowAnother = false, autoFocus = true }: Props) {
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
          <SecondaryButton size="lg" fullWidth label={t("pairAnotherTv")} onPress={handleReset} style={st.another} />
        ) : null}
      </View>
    );
  } else {
    body = (
      <>
        <PairCodeInputs ref={codeInputsRef} chars={chars} onChange={setChars} status={status} autoFocus={autoFocus} />
        {status === "error" && errorMsg ? (
          <View style={st.errorRow} accessibilityLiveRegion="polite">
            <Feather name="alert-circle" size={16} color={theme.colors.status.error} />
            <Text style={st.errorText}>{errorMsg}</Text>
          </View>
        ) : null}
        {status === "error" ? (
          <SecondaryButton size="lg" fullWidth label={t("common:retry")} onPress={handleReset} />
        ) : (
          <PrimaryButton
            tone="contrast"
            size="lg"
            fullWidth
            label={t("pairTV")}
            onPress={submit}
            disabled={!canSubmit}
            loading={status === "pairing"}
          />
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
});
