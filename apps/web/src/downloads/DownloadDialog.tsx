/**
 * Dialogue de téléchargement (film, épisode ou saison entière).
 * Variante Original (taille exacte) ou Allégé (3 presets + estimation),
 * piste audio / burn-in (Allégé, item seul), « supprimer après visionnage ».
 * Refus d'espace : message précis demandé vs disponible (renvoyé par le
 * moteur, marge 2 Gio comprise). Animations CSS pures, tokens de thème only.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { backendUrl } from "../main";
import { useToast } from "../contexts/ToastContext";
import { enqueueDownloads } from "./api";
import { refreshLibraryPrefsCache } from "../offline/localTrackPrefs";
import { LIGHT_PRESETS, formatBytes, type LightPresetId } from "./presets";
import { audioTracks, batchSizeBytes, buildEnqueueItem, imageSubtitleTracks } from "./downloadTargets";
import { useDownloadCapabilities } from "./useDownloadCapabilities";
import { useDiskInfo } from "./useDownloadState";

interface DownloadDialogProps {
  items: MediaItem[];
  seasonMode?: boolean;
  /** Titre spécifique (ex. « Télécharger la sélection (3 épisodes) »). */
  batchTitle?: string;
  onClose: () => void;
}

export function DownloadDialog({ items, seasonMode = false, batchTitle, onClose }: DownloadDialogProps) {
  const { t } = useTranslation(["downloads", "common"]);
  const { show } = useToast();
  const userId = useUserId();
  const { capabilities } = useDownloadCapabilities();
  const { freeBytes } = useDiskInfo();

  const [variant, setVariant] = useState<"original" | "light">("original");
  const [preset, setPreset] = useState<LightPresetId>("p720");
  const [audioIndex, setAudioIndex] = useState<number | undefined>(undefined);
  const [burnIndex, setBurnIndex] = useState<number | undefined>(undefined);
  const [autoDelete, setAutoDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [spaceError, setSpaceError] = useState<{ needed: number; free: number } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const single = !seasonMode && items.length === 1 ? items[0] : null;
  const audio = useMemo(() => (single ? audioTracks(single) : []), [single]);
  const imageSubs = useMemo(() => (single ? imageSubtitleTracks(single) : []), [single]);
  const options = { variant, preset, autoDeleteAfterWatch: autoDelete, audioStreamIndex: audioIndex, burnSubtitleIndex: burnIndex };
  const size = useMemo(() => batchSizeBytes(items, options), [items, variant, preset]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = async () => {
    if (!userId || submitting) return;
    const token = localStorage.getItem("tentacle_token");
    if (!token) return;
    setSubmitting(true);
    setSpaceError(null);
    const payload = items.map((item) => buildEnqueueItem(item, options));
    const outcome = await enqueueDownloads(userId, backendUrl, token, payload);
    setSubmitting(false);
    if (!outcome) {
      show("error", t("downloads:startFailed"));
      return;
    }
    if (!outcome.accepted) {
      setSpaceError({ needed: outcome.neededBytes, free: outcome.freeBytes });
      return;
    }
    // Photographie les préférences de langues au moment du téléchargement :
    // elles doivent être disponibles hors ligne même si l'utilisateur ne
    // repasse plus jamais en ligne d'ici la lecture.
    void refreshLibraryPrefsCache(userId, backendUrl);
    show("success", seasonMode ? t("downloads:seasonQueued", { count: items.length }) : t("downloads:queued"));
    onClose();
  };

  const title =
    batchTitle ??
    (seasonMode
      ? t("downloads:dialogTitleSeason", { count: items.length })
      : t("downloads:dialogTitle"));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0" style={{ background: "var(--glass-backdrop)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-md origin-center animate-scale-in overflow-hidden rounded-2xl border border-line-subtle"
        style={{
          background: "var(--surface-modal)",
          boxShadow: "var(--shadow-modal)",
          backdropFilter: "blur(var(--blur-modal))",
          WebkitBackdropFilter: "blur(var(--blur-modal))",
        }}
      >
        <div className="border-b border-line-subtle px-5 py-4">
          <h2 className="text-base font-bold text-content-primary">{title}</h2>
          <p className="mt-0.5 truncate text-sm text-content-tertiary">
            {seasonMode ? items[0]?.SeriesName ?? "" : items[0]?.Name ?? ""}
          </p>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4">
          {/* Variante */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <VariantCard
              selected={variant === "original"}
              onSelect={() => setVariant("original")}
              label={t("downloads:variantOriginal")}
              description={t("downloads:variantOriginalDesc")}
            />
            <VariantCard
              selected={variant === "light"}
              onSelect={() => capabilities.lightDownloads && setVariant("light")}
              label={t("downloads:variantLight")}
              description={t("downloads:variantLightDesc")}
              hidden={!capabilities.lightDownloads}
            />
          </div>

          {/* Presets Allégé */}
          {variant === "light" && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-content-quaternary">
                {t("downloads:presetLabel")}
              </p>
              <div className="flex gap-2">
                {LIGHT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors duration-150 ${
                      preset === p.id
                        ? "border-line-focus bg-fill-medium text-content-primary"
                        : "border-line-subtle bg-fill-subtle text-content-tertiary hover:bg-fill-soft"
                    }`}
                  >
                    {p.maxHeight}p
                    <span className="mt-0.5 block text-[10px] font-normal text-content-quaternary">
                      {Math.round(p.videoBitRate / 1_000_000)} Mb/s
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Piste audio + burn-in (Allégé, item seul) */}
          {variant === "light" && single && audio.length > 1 && (
            <SelectRow
              label={t("downloads:audioTrack")}
              value={audioIndex === undefined ? "" : String(audioIndex)}
              onChange={(value) => setAudioIndex(value === "" ? undefined : Number(value))}
              emptyLabel={t("downloads:audioDefault")}
              options={audio.map((s) => ({
                value: String(s.Index),
                label: s.DisplayTitle ?? `${s.Language ?? "?"} (#${s.Index})`,
              }))}
            />
          )}
          {variant === "light" && single && imageSubs.length > 0 && (
            <SelectRow
              label={t("downloads:burnSubtitle")}
              value={burnIndex === undefined ? "" : String(burnIndex)}
              onChange={(value) => setBurnIndex(value === "" ? undefined : Number(value))}
              emptyLabel={t("downloads:burnNone")}
              options={imageSubs.map((s) => ({
                value: String(s.Index),
                label: s.DisplayTitle ?? `${s.Language ?? "?"} (#${s.Index})`,
              }))}
            />
          )}

          {/* Supprimer après visionnage */}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-fill-faint px-3 py-2.5">
            <span className="text-sm text-content-secondary">{t("downloads:autoDeleteAfterWatch")}</span>
            <input
              type="checkbox"
              checked={autoDelete}
              onChange={(e) => setAutoDelete(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
          </label>

          {/* Tailles + espace */}
          <div className="space-y-1 text-xs text-content-tertiary">
            <p>
              {variant === "original"
                ? t("downloads:exactSize", { size: formatBytes(size) })
                : t("downloads:estimatedSize", { size: formatBytes(size) })}
            </p>
            <p>{t("downloads:freeSpace", { size: formatBytes(freeBytes) })}</p>
          </div>

          {spaceError && (
            <p className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2 text-xs leading-relaxed text-status-error-fg">
              {t("downloads:notEnoughSpace", {
                needed: formatBytes(spaceError.needed),
                free: formatBytes(spaceError.free),
              })}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line-subtle px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-cta-ghost-bg px-4 py-2 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-cta-ghost-bg-hover"
          >
            {t("common:cancel")}
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={submitting}
            className="rounded-md bg-cta-primary-bg px-5 py-2 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover disabled:opacity-50"
          >
            {t("downloads:start")}
          </button>
        </div>
      </div>
    </div>
  );
}

function VariantCard({
  selected,
  onSelect,
  label,
  description,
  hidden,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description: string;
  hidden?: boolean;
}) {
  // Invisibilité stricte : sans droit Allégé, la carte n'est PAS rendue
  // (ni grisée, ni cadenassée).
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border px-3 py-3 text-left transition-colors duration-150 ${
        selected
          ? "border-line-focus bg-fill-medium"
          : "border-line-subtle bg-fill-subtle hover:bg-fill-soft"
      }`}
    >
      <span className="block text-sm font-bold text-content-primary">{label}</span>
      <span className="mt-0.5 block text-xs leading-snug text-content-tertiary">{description}</span>
    </button>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  emptyLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  emptyLabel: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-content-quaternary">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line-subtle bg-fill-subtle px-3 py-2 text-sm text-content-primary"
        style={{ background: "var(--surface-2)" }}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
