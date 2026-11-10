/**
 * Les pièces d'une ligne de téléchargement : le badge d'état, les boutons
 * d'action et la barre de progression. Sorties de `DownloadRow` pour qu'il
 * reste sous les 300 lignes.
 */

import { useTranslation } from "react-i18next";
import { PauseIcon as Pause, PlayIcon as Play } from "../components/icons/transport";
import { ArrowClockwiseIcon as RotateCw } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { SquareIcon as Square } from "@phosphor-icons/react/dist/csr/Square";
import { TrashIcon as Trash2 } from "@phosphor-icons/react/dist/csr/Trash";
import type { DownloadEntry } from "./api";
import { OfflineGauge } from "./ui/OfflineGauge";

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
  // Les puces du socle : une information, jamais un bouton.
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: t("statusQueued"), className: "" },
    downloading: {
      label: phase === "finalize" ? t("statusFinalizing") : t("statusDownloading"),
      className: "chip-accent",
    },
    paused: { label: t("statusPaused"), className: "chip-warning" },
    complete: { label: t("statusComplete"), className: "chip-success" },
    error: {
      label: errorKey === undefined ? t("statusError") : t(errorKey),
      className: "chip-danger",
    },
    canceled: { label: t("statusCanceled"), className: "" },
  };
  const badge = map[status];
  if (!badge) return null;
  return (
    <span className={`chip flex-shrink-0 ${badge.className}`} data-status={status}>
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
    // Le bouton d'icône du socle (32 px) : pression à 97 %, couleur au survol.
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`icon-btn btn-sm ${danger ? "text-status-error-fg hover:bg-danger-surface hover:text-status-error-fg" : ""}`}
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
    <button type="button" onClick={onClick} className="btn btn-accent btn-sm">
      <RotateCw className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

/**
 * La barre d'une ligne : la jauge du hors ligne (`scaleX`, jamais une largeur) — au dégradé de
 * jauge en transfert, grise en pause, rouge en échec : l'état se lit aussi sur la barre.
 */
export function RowProgress({ ratio, status, label }: { ratio: number; status: DownloadEntry["status"]; label: string }) {
  const tone = status === "error" ? "error" : status === "paused" ? "paused" : "lot";
  return <OfflineGauge ratio={ratio} label={label} tone={tone} live={status === "downloading"} />;
}

/** « S01E05 », ou `null` si ce n'est pas un épisode numéroté — même code que le téléphone. */
export function episodeCode(entry: Pick<DownloadEntry, "kind" | "indexNumber" | "parentIndexNumber">): string | null {
  if (entry.kind !== "episode" || entry.indexNumber == null) return null;
  const season = String(entry.parentIndexNumber ?? 1).padStart(2, "0");
  return `S${season}E${String(entry.indexNumber).padStart(2, "0")}`;
}
