import { memo } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, CircleHelp, Lightbulb, LoaderCircle, OctagonAlert, type LucideIcon } from "lucide-react";
import type { AdminAttention } from "@tentacle-tv/shared";

/**
 * L'état du serveur en UNE ligne, sous le titre de la vue d'ensemble :
 * « Tout fonctionne », ou « 1 point à régler · 3 recommandations ». Rien ne
 * se dit tant qu'une source n'a pas répondu — un « Tout fonctionne » qui
 * deviendrait « 1 point à régler » deux secondes plus tard serait pire que
 * d'attendre. Icône ET mots : l'état ne se lit jamais à la seule couleur.
 */

type Tone = "success" | "error" | "brand" | "neutral";

const BOX: Record<Tone, string> = {
  success: "bg-status-success-bg text-status-success-fg",
  error: "bg-status-error-bg text-status-error-fg",
  brand: "bg-[var(--brand-soft)] text-[var(--brand-light)]",
  neutral: "bg-fill-subtle text-content-secondary",
};

export const AttentionStatus = memo(function AttentionStatus({ attention, servicesFailed }: { attention: AdminAttention; servicesFailed: boolean }) {
  const { t } = useTranslation("adminOverview");
  const blocking = attention.blocking.length;
  const recommendations = attention.recommendations.length;

  const [tone, Icon, main, extra]: [Tone, LucideIcon, string, string | null] = !attention.settled
    ? ["neutral", LoaderCircle, t("statusChecking"), null]
    : blocking > 0
      ? ["error", OctagonAlert, t("statusBlocking", { count: blocking }), recommendations > 0 ? t("statusRecommendations", { count: recommendations }) : null]
      : recommendations > 0
        ? ["brand", Lightbulb, t("statusRecommendations", { count: recommendations }), null]
        : servicesFailed
          ? ["neutral", CircleHelp, t("statusUnknown"), null]
          : ["success", CircleCheck, t("statusAllGood"), null];

  return (
    <p role="status" className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full px-3.5 py-1.5 text-sm ${BOX[tone]}`}>
      <Icon size={16} aria-hidden="true" className={`flex-shrink-0 ${attention.settled ? "" : "motion-safe:animate-spin"}`} />
      <span className="font-semibold">{main}</span>
      {extra ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{extra}</span>
        </>
      ) : null}
    </p>
  );
});
