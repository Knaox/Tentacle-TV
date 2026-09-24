import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleAlert, LoaderCircle, Pause, Play } from "lucide-react";
import type { Feedback } from "@tentacle-tv/shared";

/**
 * La ligne d'état d'une lecture — « En lecture », « En pause » — qui suit
 * aussi la commande en cours : « Pause demandée… » tant que l'appareil ne
 * l'a pas appliquée, une coche quand l'instantané la constate, un
 * avertissement s'il tarde. C'est ici que l'appui devient visible jusqu'au
 * bout : le bouton dit « envoyé », la ligne dit « fait ».
 *
 * `aria-live` : un lecteur d'écran entend le verdict sans aller le chercher.
 */

const REQUESTED = { Pause: "pauseRequested", Unpause: "resumeRequested", Stop: "stopRequested" } as const;

export const CommandStatus = memo(function CommandStatus({ isPaused, feedback }: {
  isPaused: boolean;
  feedback: Feedback | undefined;
}) {
  const { t } = useTranslation("sessions");
  const command = feedback && feedback.command !== "message" ? feedback.command : null;
  const phase = command === null ? null : feedback?.phase;

  let content;
  if (command !== null && (phase === "sending" || phase === "waiting")) {
    content = (
      <span className="inline-flex items-center gap-1.5 font-medium text-[var(--brand-light)]">
        <LoaderCircle size={12} aria-hidden className="animate-spin" />
        {t(REQUESTED[command])}
      </span>
    );
  } else if (command !== null && phase === "late") {
    content = (
      <span className="inline-flex items-center gap-1.5 font-medium text-status-warning-fg">
        <CircleAlert size={12} aria-hidden />
        {t("deviceLate")}
      </span>
    );
  } else if ((command === "Pause" || command === "Unpause") && phase === "done") {
    content = (
      <span className="inline-flex animate-scale-in items-center gap-1.5 font-medium text-status-success-fg">
        <Check size={12} aria-hidden strokeWidth={2.6} />
        {isPaused ? t("paused") : t("playing")}
      </span>
    );
  } else {
    content = (
      <span className="inline-flex items-center gap-1">
        {isPaused ? <Pause size={12} aria-hidden /> : <Play size={12} aria-hidden />}
        {isPaused ? t("paused") : t("playing")}
      </span>
    );
  }

  return <span aria-live="polite">{content}</span>;
});
