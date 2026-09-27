/**
 * Les pièces d'une ligne de téléchargement : le badge d'état, les boutons
 * d'action et la barre de progression. Sorties de `DownloadRow` pour qu'il
 * reste sous les 300 lignes.
 */

import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCw, Square, Trash2 } from "lucide-react";
import type { DownloadEntry } from "./api";

/**
 * Les causes d'erreur telles qu'elles sont écrites en base. Seul `disk-full`
 * avait un libellé : tout le reste disait « Erreur », sans plus — y compris un
 * média retiré du serveur ou un fichier reçu tronqué, qui n'appellent pas du
 * tout le même geste.
 */
const ERROR_KEYS: Record<string, string> = {
  "disk-full": "errorDiskFull",
  unavailable: "errorUnavailable",
  integrity: "errorIntegrity",
  missing: "errorMissing",
  io: "errorIo",
  finalize: "errorFinalize",
  audio: "errorAudio",
  unexpected: "errorUnexpected",
};

export function StatusBadge({
  status,
  errorCode,
  phase,
}: {
  status: DownloadEntry["status"];
  errorCode: string | null;
  phase?: string | null;
}) {
  const { t } = useTranslation("downloads");
  const errorKey = errorCode === null ? undefined : ERROR_KEYS[errorCode];
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: t("statusQueued"), className: "bg-status-info-bg text-status-info-fg" },
    downloading: {
      label: phase === "finalize" ? t("statusFinalizing") : t("statusDownloading"),
      className: "bg-status-info-bg text-status-info-fg",
    },
    paused: { label: t("statusPaused"), className: "bg-status-warning-bg text-status-warning-fg" },
    complete: { label: t("statusComplete"), className: "bg-status-success-bg text-status-success-fg" },
    error: {
      label: errorKey === undefined ? t("statusError") : t(errorKey),
      className: "bg-status-error-bg text-status-error-fg",
    },
    canceled: { label: t("statusCanceled"), className: "bg-fill-soft text-content-tertiary" },
  };
  const badge = map[status];
  if (!badge) return null;
  return (
    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
      {badge.label}
    </span>
  );
}

const GLYPHS = { pause: Pause, play: Play, stop: Square, trash: Trash2, retry: RotateCw } as const;
export type ActionGlyph = keyof typeof GLYPHS;

export function SmallAction({
  label,
  onClick,
  glyph,
  danger,
}: {
  label: string;
  onClick: () => void;
  glyph: ActionGlyph;
  danger?: boolean;
}) {
  const Icon = GLYPHS[glyph];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${
        danger
          ? "text-status-error-fg hover:bg-danger-surface"
          : "text-content-tertiary hover:bg-fill-soft hover:text-content-primary"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

/**
 * « Réessayer » en toutes lettres sur une ligne en échec : l'icône lecture
 * seule ne disait pas qu'elle relançait un transfert tombé.
 */
export function RetryAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[rgba(var(--brand-rgb),0.16)] px-3 text-xs font-semibold text-[var(--brand-light)] transition-colors duration-150 hover:bg-[rgba(var(--brand-rgb),0.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    >
      <RotateCw className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

/**
 * La barre d'une ligne. Remplissage en `scaleX` — un `width` animé repeignait
 * la ligne à chaque échantillon —, dégradé violet → rose, gris en pause, rouge
 * en échec : l'état se lit aussi sur la barre, pas seulement sur le badge.
 */
export function RowProgress({ ratio, status }: { ratio: number; status: DownloadEntry["status"] }) {
  const tone =
    status === "error"
      ? "bg-status-error"
      : status === "paused"
        ? "bg-fill-strong"
        : "bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]";
  return (
    <div className="h-1 flex-1 overflow-hidden rounded-full bg-fill-soft">
      <div
        className={`h-full w-full origin-left rounded-full transition-transform duration-300 motion-reduce:transition-none ${tone}`}
        style={{ transform: `scaleX(${Math.max(0, Math.min(1, ratio))})` }}
      />
    </div>
  );
}
