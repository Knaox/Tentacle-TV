/**
 * Dialogue de téléchargement — film, épisode, saison ou série entière.
 *
 * Parti d'un épisode, il laisse ÉLARGIR sur place : cet épisode, sa saison, ou
 * toute la série, avec une case par saison (série) ou par épisode (saison), et
 * ce qui est déjà sur la machine coché-gris. Pas de seconde fenêtre : le
 * contenu change là où on regarde, comme sur le téléphone.
 *
 * Variante Original (taille exacte) ou Allégé (3 paliers + estimation), piste
 * audio / incrustation (Allégé, titre seul), « supprimer après visionnage ».
 * Refus d'espace : message précis demandé vs disponible (renvoyé par le moteur,
 * marge 2 Gio comprise). Animations CSS pures, jetons de thème seulement.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { LIGHT_PRESETS, formatBytes } from "./presets";
import { AutoDeleteSelect } from "./AutoDeleteSelect";
import { EpisodeChecklist, SeasonChecklist } from "./DownloadChecklists";
import { ScopeChoice } from "./ScopeChoice";
import { useDownloadCapabilities } from "./useDownloadCapabilities";
import { useDownloadDialogState } from "./useDownloadDialogState";
import { useDiskInfo } from "./useDownloadState";
import type { DownloadMode } from "./useDownloadScope";

interface DownloadDialogProps {
  items: MediaItem[];
  /** `single` (défaut), `season` (barre de saison), `series` (fiche de série). */
  mode?: DownloadMode;
  /** Titre spécifique (ex. « Télécharger la sélection (3 épisodes) »). */
  batchTitle?: string;
  onClose: () => void;
}

export function DownloadDialog({ items: requested, mode: requestedMode = "single", batchTitle, onClose }: DownloadDialogProps) {
  const { t } = useTranslation(["downloads", "common"]);
  const { capabilities } = useDownloadCapabilities();
  const { freeBytes } = useDiskInfo();
  const state = useDownloadDialogState(requested, requestedMode, onClose);
  const { scope, mode, items, sourceItems, onDevice, selected, unchecked, single, variant, preset } = state;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const title =
    batchTitle ??
    (mode === "series"
      ? t("downloads:dialogTitleSeries")
      : mode === "season"
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
            {mode === "single" ? sourceItems[0]?.Name ?? "" : sourceItems[0]?.SeriesName ?? ""}
          </p>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4">
          {/* Périmètre : seulement quand la demande part d'un épisode. */}
          {scope.scope !== null && (
            <ScopeChoice
              value={scope.scope}
              busy={scope.loading}
              onChange={(next) => {
                state.resetSelection();
                scope.setScope(next);
              }}
            />
          )}
          {scope.failed && <p className="text-xs text-content-tertiary">{t("downloads:scopeFailed")}</p>}
          {mode === "series" && (
            <SeasonChecklist
              episodes={sourceItems}
              uncheckedSeasons={unchecked}
              onDevice={onDevice}
              sizeOf={state.sizeOf}
              onToggle={state.toggle}
            />
          )}
          {mode === "season" && sourceItems.length > 1 && (
            <EpisodeChecklist
              items={sourceItems}
              selected={selected}
              onDevice={onDevice}
              sizeOf={state.sizeOf}
              onToggle={state.toggle}
            />
          )}

          {/* Variante */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <VariantCard
              selected={variant === "original"}
              onSelect={() => state.setVariant("original")}
              label={t("downloads:variantOriginal")}
              description={t("downloads:variantOriginalDesc")}
            />
            <VariantCard
              selected={variant === "light"}
              onSelect={() => capabilities.lightDownloads && state.setVariant("light")}
              label={t("downloads:variantLight")}
              description={t("downloads:variantLightDesc")}
              hidden={!capabilities.lightDownloads}
            />
          </div>

          {/* Paliers Allégé */}
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
                    onClick={() => state.setPreset(p.id)}
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

          {/* Piste audio + incrustation (Allégé, titre seul) */}
          {variant === "light" && single && state.audio.length > 1 && (
            <SelectRow
              label={t("downloads:audioTrack")}
              value={state.audioIndex === undefined ? "" : String(state.audioIndex)}
              onChange={(value) => state.setAudioIndex(value === "" ? undefined : Number(value))}
              emptyLabel={t("downloads:audioDefault")}
              options={state.audio.map((s) => ({
                value: String(s.Index),
                label: s.DisplayTitle ?? `${s.Language ?? "?"} (#${s.Index})`,
              }))}
            />
          )}
          {variant === "light" && single && state.imageSubs.length > 0 && (
            <SelectRow
              label={t("downloads:burnSubtitle")}
              value={state.burnIndex === undefined ? "" : String(state.burnIndex)}
              onChange={(value) => state.setBurnIndex(value === "" ? undefined : Number(value))}
              emptyLabel={t("downloads:burnNone")}
              options={state.imageSubs.map((s) => ({
                value: String(s.Index),
                label: s.DisplayTitle ?? `${s.Language ?? "?"} (#${s.Index})`,
              }))}
            />
          )}

          {/* Supprimer après visionnage : délai au choix */}
          <div className="flex items-center justify-between gap-3 rounded-lg bg-fill-faint px-3 py-2.5">
            <span className="text-sm text-content-secondary">{t("downloads:autoDeleteAfterWatch")}</span>
            <AutoDeleteSelect value={state.autoDeleteDelay} onChange={state.setAutoDeleteDelay} />
          </div>

          {/* Tailles + espace */}
          <div className="space-y-1 text-xs text-content-tertiary">
            <p>
              {variant === "original"
                ? t("downloads:exactSize", { size: formatBytes(state.size) })
                : t("downloads:estimatedSize", { size: formatBytes(state.size) })}
            </p>
            <p>{t("downloads:freeSpace", { size: formatBytes(freeBytes) })}</p>
          </div>

          {state.spaceError && (
            <p className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2 text-xs leading-relaxed text-status-error-fg">
              {t("downloads:notEnoughSpace", {
                needed: formatBytes(state.spaceError.needed),
                free: formatBytes(state.spaceError.free),
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
            onClick={() => void state.start()}
            disabled={state.submitting || scope.loading || items.length === 0}
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
