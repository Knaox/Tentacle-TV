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
 * marge 2 Gio comprise).
 *
 * La feuille du socle (refonte de nov. 2026) : opaque, en portail, 320 ms à
 * l'entrée et 200 à la sortie ; l'en-tête dit QUOI, le pied dit COMBIEN ça
 * pèse et ce que le bouton va lancer (« Télécharger 8 épisodes »).
 */

import { useTranslation } from "react-i18next";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import type { MediaItem } from "@tentacle-tv/shared";
import { ModalHeader } from "../components/ui/ModalHeader";
import { LIGHT_PRESETS, formatBytes, type LightPresetId } from "./presets";
import { AutoDeleteSelect } from "./AutoDeleteSelect";
import { EpisodeChecklist, SeasonChecklist } from "./DownloadChecklists";
import { DialogFooter, SpaceRefusal, TrackSelect, VariantTile } from "./DownloadDialogParts";
import { OfflineSheetFrame } from "./OfflineSheetFrame";
import { ScopeChoice } from "./ScopeChoice";
import { SheetSegments } from "./ui/SheetSegments";
import { useSheetExit } from "./ui/useSheetExit";
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

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Sous le titre : de quoi l'on parle — le film, « Série — Épisode », « Série · Saison 2 ». */
function subjectOf(t: Translate, mode: DownloadMode, items: readonly MediaItem[]): string {
  const first = items[0];
  if (first === undefined) return "";
  if (mode === "single") return first.Type === "Episode" && first.SeriesName ? `${first.SeriesName} — ${first.Name}` : (first.Name ?? "");
  const series = first.SeriesName ?? "";
  const seasons = new Set(items.map((item) => item.ParentIndexNumber ?? null));
  const only = seasons.size === 1 ? first.ParentIndexNumber : null;
  return mode === "season" && only != null ? `${series} · ${t("downloads:seasonLabel", { num: only })}` : series;
}

/** Ce que le bouton lance, en toutes lettres. */
function startLabelOf(t: Translate, mode: DownloadMode, items: readonly MediaItem[]): string {
  if (items.length === 0) return t("downloads:start");
  if (mode !== "single") return t("downloads:dialogStartEpisodes", { count: items.length });
  return items[0]?.Type === "Episode" ? t("downloads:episodeDownload") : t("downloads:dialogStartMovie");
}

export function DownloadDialog({ items: requested, mode: requestedMode = "single", batchTitle, onClose }: DownloadDialogProps) {
  const { t } = useTranslation(["downloads", "common"]);
  const { capabilities } = useDownloadCapabilities();
  const { freeBytes } = useDiskInfo();
  const exit = useSheetExit(onClose);
  const state = useDownloadDialogState(requested, requestedMode, exit.close);
  const { scope, mode, items, sourceItems, onDevice, selected, unchecked, single, variant, preset } = state;

  const title =
    batchTitle ??
    (mode === "series"
      ? t("downloads:dialogTitleSeries")
      : mode === "season"
        ? t("downloads:dialogTitleSeason", { count: items.length })
        : t("downloads:dialogTitle"));
  const tight = state.size !== null && freeBytes !== null && state.size > freeBytes;

  return (
    <OfflineSheetFrame label={title} open={exit.open} onClose={exit.close} width="md">
      <ModalHeader title={title} subtitle={subjectOf(t as Translate, mode, sourceItems)} onClose={exit.close} />

      <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-6 py-5">
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
        {scope.failed && <p className="text-[13px] text-content-tertiary">{t("downloads:scopeFailed")}</p>}
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

        {/* Qualité : la variante, puis les paliers de l'Allégé. */}
        <div className="flex flex-col gap-2.5">
          <span className="ui-eyebrow">{t("downloads:presetLabel")}</span>
          <div className="flex flex-wrap items-stretch gap-2.5">
            <VariantTile
              selected={variant === "original"}
              onSelect={() => state.setVariant("original")}
              label={t("downloads:variantOriginal")}
              description={t("downloads:variantOriginalDesc")}
            />
            <VariantTile
              selected={variant === "light"}
              onSelect={() => capabilities.lightDownloads && state.setVariant("light")}
              label={t("downloads:variantLight")}
              description={t("downloads:variantLightDesc")}
              hidden={!capabilities.lightDownloads}
            />
          </div>
          {variant === "light" && (
            <SheetSegments<LightPresetId>
              label={t("downloads:presetLabel")}
              value={preset}
              onChange={state.setPreset}
              options={LIGHT_PRESETS.map((p) => ({
                value: p.id,
                label: `${p.maxHeight}p`,
                hint: `${Math.round(p.videoBitRate / 1_000_000)} Mb/s`,
              }))}
            />
          )}
        </div>

        {/* Piste audio + incrustation (Allégé, titre seul) */}
        {variant === "light" && single && state.audio.length > 1 && (
          <TrackSelect
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
          <TrackSelect
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile bg-surface-2 py-2.5 pl-3.5 pr-2.5">
          <span className="text-sm text-content-secondary">{t("downloads:autoDeleteAfterWatch")}</span>
          <AutoDeleteSelect value={state.autoDeleteDelay} onChange={state.setAutoDeleteDelay} />
        </div>

        {mode !== "single" && items.length === 0 && !scope.loading && (
          <p className="text-[13px] text-content-tertiary">{t("downloads:dialogNothingToStart")}</p>
        )}

        {state.spaceError && (
          <SpaceRefusal>
            {t("downloads:notEnoughSpace", {
              needed: formatBytes(state.spaceError.needed),
              free: formatBytes(state.spaceError.free),
            })}
          </SpaceRefusal>
        )}
      </div>

      <DialogFooter
        size={formatBytes(state.size)}
        sizeCaption={t(variant === "original" ? "downloads:dialogSizeExact" : "downloads:dialogSizeEstimated")}
        freeCaption={t("downloads:dialogFreeSpace", { size: formatBytes(freeBytes) })}
        tight={tight}
        cancelLabel={t("common:cancel")}
        startLabel={startLabelOf(t as Translate, mode, items)}
        startIcon={<DownloadSimpleIcon size={16} weight="bold" aria-hidden />}
        startDisabled={state.submitting || scope.loading || items.length === 0}
        onCancel={exit.close}
        onStart={() => void state.start()}
      />
    </OfflineSheetFrame>
  );
}
