import { memo } from "react";
import { AlertTriangle, Check, Gauge, KeyRound, Pause, Server, WifiOff, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NoticeSeverity } from "@tentacle-tv/shared";
import type { MessageCountdown } from "../session/useMessageCountdown";

export type NoticeIcon = "server" | "key" | "check" | "alert" | "gauge" | "wifiOff";

export interface NoticeCardAction {
  label: string;
  onClick: () => void;
}

const ICONS: Record<NoticeIcon, LucideIcon> = { server: Server, key: KeyRound, check: Check, alert: AlertTriangle, gauge: Gauge, wifiOff: WifiOff };

/** La couleur de la gravité : la barre de gauche, la pastille, la barre du temps. */
const TONES: Record<NoticeSeverity, { accent: string; chip: string }> = {
  blocking: { accent: "bg-status-error", chip: "bg-status-error-bg text-status-error-fg" },
  recommendation: { accent: "bg-status-warning", chip: "bg-status-warning-bg text-status-warning-fg" },
  info: { accent: "bg-brand", chip: "bg-fill-soft text-content-primary" },
};

/**
 * Les classes de chaque surface. `player` : posée sur la vidéo — sombre EN DUR
 * dans les deux thèmes, comme tout ce que dessine le lecteur (une carte claire
 * sur un film éblouirait) ; le texte reste au-dessus de 4,5:1 sur ce fond.
 */
const SURFACES = {
  app: {
    root: "border-line-strong bg-surface-3 text-content-primary",
    meta: "text-content-tertiary",
    line: "text-content-secondary",
    secondary: "border-line-strong text-content-secondary hover:bg-fill-soft hover:text-content-primary",
    close: "text-content-tertiary hover:bg-fill-soft hover:text-content-primary",
    track: "bg-surface-2",
    infoChip: "bg-fill-soft text-content-primary",
  },
  player: {
    root: "border-white/15 bg-[rgba(12,10,20,0.92)] text-white",
    meta: "text-white/60",
    line: "text-white/80",
    secondary: "border-white/25 text-white/85 hover:bg-white/10 hover:text-white",
    close: "text-white/70 hover:bg-white/10 hover:text-white",
    track: "bg-white/10",
    infoChip: "bg-white/10 text-white",
  },
} as const;

interface Props {
  severity: NoticeSeverity;
  icon: NoticeIcon;
  title?: string;
  lines: string[];
  primary?: NoticeCardAction;
  secondary?: NoticeCardAction;
  onClose: () => void;
  /** Le compte à rebours d'un avertissement qui s'efface seul ; `null` : il reste. */
  countdown: MessageCountdown | null;
  durationMs: number | null;
  /** `player` : posée sur la vidéo (cf. `SURFACES`). Défaut : la surface de l'app, qui suit le thème. */
  surface?: keyof typeof SURFACES;
}

/**
 * Un avertissement surgissant du web et du bureau — la famille des messages
 * de l'administrateur (`MessageBannerCard`) : surface pleine, liseré net,
 * barre de couleur à gauche (rouge pour une panne, ambre pour une
 * recommandation), le temps qui reste écrit et une barre qui se vide — tous
 * deux suspendus au survol et au focus. Ni flou ni dégradé : la vidéo macOS
 * vit sous la fenêtre, et rien de ce qui est caché ne coûte (règles « Coût
 * GPU »). La croix fait 44 px ; « Ne plus afficher » est un geste du COMPTE.
 */
export const NoticeCard = memo(function NoticeCard({
  severity, icon, title, lines, primary, secondary, onClose, countdown, durationMs, surface = "app",
}: Props) {
  const { t } = useTranslation(["notices", "sessions"]);
  const tone = TONES[severity];
  const look = SURFACES[surface];
  const chip = severity === "info" ? look.infoChip : tone.chip;
  const Icon = ICONS[icon];
  return (
    <div
      role={severity === "blocking" ? "alert" : "status"}
      className={`relative flex items-stretch gap-3 overflow-hidden rounded-xl border py-3 pl-3 pr-1 shadow-xl ${look.root}`}
    >
      <span aria-hidden className={`w-1 shrink-0 rounded-full ${tone.accent}`} />
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start gap-2.5">
          <span aria-hidden className={`mt-px grid h-7 w-7 shrink-0 place-items-center rounded-full ${chip}`}>
            <Icon size={15} />
          </span>
          <div className="min-w-0 flex-1">
            {countdown !== null && (
              <p className={`flex h-4 items-center gap-1 text-xs font-medium tabular-nums leading-4 ${look.meta}`}>
                {!countdown.running && <Pause size={11} aria-hidden />}
                {t(countdown.running ? "sessions:vanishesIn" : "sessions:vanishHeld", { count: countdown.secondsLeft })}
              </p>
            )}
            {title && <p className="mt-0.5 break-words text-sm font-semibold">{title}</p>}
            {lines.map((line, index) => (
              <p key={index} className={`mt-1 break-words text-sm leading-relaxed ${look.line}`}>{line}</p>
            ))}
          </div>
        </div>
        {(primary || secondary) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pl-[38px]">
            {primary && (
              <button
                type="button"
                onClick={primary.onClick}
                className="inline-flex min-h-[36px] cursor-pointer items-center rounded-[18px] border border-cta-primary-border bg-cta-primary-bg px-4 py-1.5 text-sm font-semibold text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-focus"
              >
                {primary.label}
              </button>
            )}
            {secondary && (
              <button
                type="button"
                onClick={secondary.onClick}
                className={`inline-flex min-h-[36px] cursor-pointer items-center rounded-[18px] border px-4 py-1.5 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-focus ${look.secondary}`}
              >
                {secondary.label}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("notices:close")}
        className={`grid h-11 w-11 shrink-0 cursor-pointer place-items-center self-start rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-line-focus ${look.close}`}
      >
        <X size={18} aria-hidden />
      </button>
      {durationMs !== null && countdown !== null && (
        // Mouvement réduit : la barre se viderait d'un coup — le temps écrit suffit.
        <span aria-hidden className={`absolute inset-x-0 bottom-0 h-[3px] motion-reduce:hidden ${look.track}`}>
          <span
            className={`block h-full origin-left animate-countdown ${tone.accent}`}
            style={{ animationDuration: `${durationMs}ms`, animationPlayState: countdown.running ? "running" : "paused" }}
          />
        </span>
      )}
    </div>
  );
});
