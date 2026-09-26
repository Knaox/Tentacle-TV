import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Clock, Tv } from "lucide-react";
import { useContentPadding } from "../../../useMirrorLayout";
import { AmbientGlow } from "../shared/AmbientGlow";
import { useBackOrHome } from "../shared/backOrHome";
import { FadeIn } from "../shared/FadeIn";
import { GlassCard } from "../shared/GlassCard";
import { PrimaryCta } from "../shared/PrimaryCta";
import { BackButton } from "../shared/ScreenTitle";
import { PairCodeInputs, type PairCodeInputsHandle } from "./PairCodeInputs";
import { PairSuccess, PairUnavailable } from "./PairCardStates";
import { usePairFlow } from "./usePairFlow";
import "../../../mirror.css";
import "../shared/screens.css";

/**
 * `PairTVScreen` de l'app (`/pair-device`) : chevron 40 à 16 du bord ; médaillon
 * TV de 96 (halo violet) ; titre 28 centré, sous-titre 14 `brand.light` ;
 * carte de verre (padding 24) dans la colonne de 640 : cases du code, erreur,
 * CTA « Jumeler » ou « Réessayer » (fantôme violet) ; note d'expiration 12.
 */
export function MirrorPairDevice() {
  const { t } = useTranslation("pairing");
  const goBack = useBackOrHome();
  const pad = useContentPadding();
  const flow = usePairFlow();
  const inputsRef = useRef<PairCodeInputsHandle>(null);
  const { reset } = flow;
  const retry = useCallback(() => {
    reset();
    inputsRef.current?.focusFirst();
  }, [reset]);

  return (
    <div className="relative" style={{ paddingBottom: 80 }}>
      <AmbientGlow />
      <div className="relative">
        <div className="flex items-center" style={{ padding: "8px 16px 0", marginBottom: 8 }}>
          <BackButton onPress={goBack} label={t("common:back")} />
        </div>

        <FadeIn translateY={10} className="flex justify-center" style={{ marginTop: 8, marginBottom: 16 }}>
          <span
            className="flex items-center justify-center rounded-full border"
            style={{
              width: 96,
              height: 96,
              background: "var(--brand-soft)",
              borderColor: "rgba(var(--brand-rgb), 0.4)",
              boxShadow: "0 0 20px rgba(var(--brand-rgb), 0.5)",
              color: "var(--brand-light)",
            }}
          >
            <Tv size={48} />
          </span>
        </FadeIn>

        <FadeIn delay={80} translateY={10}>
          <h1 className="text-center font-extrabold text-content-primary" style={{ fontSize: 28, letterSpacing: -0.6, marginBottom: 6 }}>
            {t("pairYourTV")}
          </h1>
          <p className="text-center font-medium" style={{ fontSize: 14, letterSpacing: 0.3, marginBottom: 24, padding: "0 32px", color: "var(--brand-light)" }}>
            {t("enterTVCode")}
          </p>
        </FadeIn>

        <FadeIn delay={140} translateY={12} style={{ paddingLeft: pad, paddingRight: pad }}>
          <GlassCard padding={24}>
            {flow.available !== true ? (
              <PairUnavailable loading={flow.available === null} />
            ) : flow.status === "success" ? (
              <PairSuccess />
            ) : (
              <>
                <PairCodeInputs ref={inputsRef} chars={flow.chars} onChange={flow.setChars} status={flow.status} />
                {flow.status === "error" && flow.errorMsg && (
                  <p className="flex items-center justify-center gap-2 text-center font-medium" style={{ fontSize: 13, marginBottom: 14, color: "var(--status-error)" }}>
                    <AlertCircle size={16} className="shrink-0" />
                    {flow.errorMsg}
                  </p>
                )}
                {flow.status === "error" ? (
                  <button
                    type="button"
                    onClick={retry}
                    className="mirror-dim flex w-full items-center justify-center rounded-lg border font-semibold text-content-primary"
                    style={{
                      minHeight: 46,
                      padding: "13px 0",
                      fontSize: 15,
                      background: "rgba(var(--brand-rgb), 0.18)",
                      borderColor: "rgba(var(--brand-rgb), 0.4)",
                    }}
                  >
                    {t("common:retry")}
                  </button>
                ) : (
                  <PrimaryCta onPress={() => void flow.submit()} disabled={!flow.canSubmit} loading={flow.status === "pairing"}>
                    {t("pairTV")}
                  </PrimaryCta>
                )}
              </>
            )}
          </GlassCard>
        </FadeIn>

        <FadeIn delay={200} translateY={8}>
          <p className="flex items-center justify-center text-center text-content-quaternary" style={{ gap: 6, marginTop: 16, padding: "0 16px", fontSize: 12 }}>
            <Clock size={12} className="shrink-0" />
            {t("codeExpireNote")}
          </p>
        </FadeIn>
      </div>
    </div>
  );
}
