import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  QUALITY_PRESETS, formatBitrateMbps, qualityDropText,
  type QualityDrop, type QualityKey, type QualityPreset, type SourceQuality,
} from "@tentacle-tv/shared";
import type { ApplyToSeriesControl } from "../hooks/useApplyToSeries";
import { parseTrackLabel } from "./trackLabel";
import { usePlayerGlassMode } from "./player/glass/PlayerGlassContext";
import { isGlassLayout } from "./player/glass/playerGlassMode";
import { GlassPanel } from "./player/glass/GlassPanel";
import { GlassChip, GlassOption } from "./player/glass/GlassOption";
import { PLAYER_MORPH } from "./player/glass/playerGlassFusion";

interface Track {
  index: number;
  label: string;
}

interface TrackSelectorProps {
  audioTracks: Track[];
  subtitleTracks: Track[];
  currentAudio: number;
  currentSubtitle: number | null;
  currentQuality: QualityKey;
  /** Qualité de la source détectée depuis les MediaStreams. */
  sourceQuality?: SourceQuality;
  /** Paliers calculés d'après la source (cf. buildQualityLadder). */
  qualityPresets?: readonly QualityPreset[];
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  onQualityChange?: (key: QualityKey) => void;
  onClose: () => void;
  /** Épisode : case « Appliquer à cette série » (préférence de langues). */
  applyToSeries?: ApplyToSeriesControl;
  /** Le mode « Auto » est armé : badge sur le palier ACTIF (la clé affichée
   *  est déjà le palier servi, cap compris) — un choix manuel l'éteint. */
  autoQualityActive?: boolean;
  /** Pourquoi la qualité baisse en Auto : relisible ici, sous les paliers. */
  qualityDrop?: QualityDrop | null;
}

export function TrackSelector({
  audioTracks, subtitleTracks,
  currentAudio, currentSubtitle, currentQuality, sourceQuality,
  qualityPresets = QUALITY_PRESETS,
  onAudioChange, onSubtitleChange, onQualityChange, onClose, applyToSeries,
  autoQualityActive = false, qualityDrop = null,
}: TrackSelectorProps) {
  const { t, i18n } = useTranslation("player");
  const dropText = qualityDrop ? qualityDropText(qualityDrop, i18n.language) : null;
  // Panneau de réglages DÉTACHÉ (fond quasi-opaque `surface-dropdown`, pas la
  // vidéo en transparence) : contrairement aux contrôles du lecteur, il suit
  // le thème clair/sombre — d'où la tokenisation du texte/bordures ici.
  //
  // Et donc PAS de `backdrop-filter` : à 0,95 d'alpha il ne reste rien à
  // flouter, alors que le panneau flotte au-dessus d'une vidéo en lecture dont
  // l'arrière-plan change à chaque image décodée.
  const glass = isGlassLayout(usePlayerGlassMode());
  const body = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-content-primary">{t("player:settings")}</span>
        <button onClick={onClose} className="text-content-quaternary hover:text-content-primary">&times;</button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
        {audioTracks.length > 0 && (
          <Section title={t("player:audio")}>
            {audioTracks.map((tr) => (
              <TrackOption
                key={tr.index}
                label={tr.label}
                active={currentAudio === tr.index}
                onClick={() => onAudioChange(tr.index)}
              />
            ))}
          </Section>
        )}

        {subtitleTracks.length > 0 && (
          <Section title={t("player:subtitles")}>
            <TrackOption label={t("player:subtitlesDisabled")} active={currentSubtitle === null} onClick={() => onSubtitleChange(null)} />
            {subtitleTracks.map((tr) => (
              <TrackOption
                key={tr.index}
                label={tr.label}
                active={currentSubtitle === tr.index}
                onClick={() => onSubtitleChange(tr.index)}
              />
            ))}
          </Section>
        )}

        {onQualityChange && (
          <Section title={t("player:quality")}>
            {qualityPresets.map((preset) => (
              <QualityOption
                key={preset.key}
                presetKey={preset.key}
                bitrate={preset.bitrate}
                active={currentQuality === preset.key}
                autoBadge={autoQualityActive && currentQuality === preset.key}
                sourceQuality={sourceQuality}
                onClick={() => onQualityChange(preset.key)}
                t={t}
              />
            ))}
            {dropText && (
              <p className="mt-1 flex items-start gap-1.5 px-3 text-xs leading-relaxed text-content-tertiary">
                <span className="font-semibold text-tentacle-accent">{t("player:qualityAutoBadge")}</span>
                <span>{t(dropText.menuKey, dropText.values)}</span>
              </p>
            )}
          </Section>
        )}
      </div>

      {applyToSeries && (
        <label
          className={`mt-3 flex select-none items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            applyToSeries.pending
              ? "pointer-events-none opacity-50"
              : "cursor-pointer text-content-secondary hover:bg-fill-subtle hover:text-content-primary"
          }`}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={applyToSeries.checked}
            disabled={applyToSeries.pending}
            onChange={(e) => applyToSeries.toggle(e.target.checked)}
          />
          <span
            aria-hidden
            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
              applyToSeries.checked
                ? "border-tentacle-accent bg-tentacle-accent"
                : "border-line-strong bg-fill-subtle"
            }`}
          >
            {applyToSeries.checked && (
              <svg viewBox="0 0 12 12" className="h-3 w-3 text-cta-brand-fg" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 6.5 5 9l4.5-6" />
              </svg>
            )}
          </span>
          {t("player:applyToSeries")}
        </label>
      )}
    </>
  );
  // Verre : le popover au-dessus de la capsule (`GlassPanel`), mêmes lignes.
  if (glass) {
    return <GlassPanel morphId={PLAYER_MORPH.tracks} className="w-80 max-w-[calc(100vw-3rem)]" bodyClassName="p-3" role="dialog" aria-label={t("player:settings")}>{body}</GlassPanel>;
  }
  return (
    <motion.div data-panneau-detache
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-20 right-6 z-50 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-line-subtle bg-[var(--surface-dropdown)] p-4"
      onClick={(e) => e.stopPropagation()}
    >
      {body}
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const glass = isGlassLayout(usePlayerGlassMode());
  return (
    <div className="mb-3 last:mb-0">
      <p className={glass ? "lgp-section-title" : "mb-1.5 text-xs font-medium uppercase tracking-wider text-content-quaternary"}>{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function QualityOption({
  presetKey, bitrate, active, autoBadge, sourceQuality, onClick, t,
}: {
  presetKey: QualityKey;
  bitrate: number | null;
  active: boolean;
  /** Le palier est servi par le mode « Auto » (cap armé, aucun choix manuel). */
  autoBadge?: boolean;
  sourceQuality?: SourceQuality;
  onClick: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const isOriginal = presetKey === "original";
  const label = isOriginal ? t("player:original") : t(`player:${presetKey}`);
  const resSuffix = isOriginal && sourceQuality?.resolution ? sourceQuality.resolution : null;
  const mbpsChip = !isOriginal && bitrate ? formatBitrateMbps(bitrate) : null;
  const glass = isGlassLayout(usePlayerGlassMode());
  const inner = (
    <span className="flex flex-1 items-center gap-1.5 overflow-hidden">
      <span className="truncate">{label}</span>
      {autoBadge && <Badge color="purple">{t("player:qualityAutoBadge")}</Badge>}
      {resSuffix && <span className="text-content-quaternary">— {resSuffix}</span>}
      {isOriginal && sourceQuality?.isDolbyVision && <Badge color="purple">DV</Badge>}
      {isOriginal && sourceQuality?.isHDR && <Badge color="amber">HDR</Badge>}
      {isOriginal && sourceQuality?.isDolbyAtmos && <Badge color="amber">Atmos</Badge>}
      {mbpsChip && <span className="ml-auto"><Badge color="zinc">{mbpsChip}</Badge></span>}
    </span>
  );
  if (glass) return <GlassOption active={active} onClick={onClick}>{inner}</GlassOption>;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active ? "bg-[rgba(var(--brand-rgb),0.25)] text-content-primary font-medium" : "text-content-tertiary hover:bg-fill-subtle hover:text-content-primary"
      }`}
    >
      <span className={`h-2 w-2 flex-shrink-0 rounded-full transition-colors ${active ? "bg-tentacle-accent shadow-[0_0_6px_rgba(var(--brand-rgb), 0.6)]" : "bg-fill-medium"}`} />
      {inner}
    </button>
  );
}

function TrackOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { lang, codec, title } = parseTrackLabel(label);
  const glass = isGlassLayout(usePlayerGlassMode());
  const inner = (
    <span className="flex flex-1 items-center gap-1.5 overflow-hidden">
      <span className="truncate">{title}</span>
      {lang && <Badge color="purple">{lang}</Badge>}
      {codec && <Badge color="zinc">{codec}</Badge>}
    </span>
  );
  if (glass) return <GlassOption active={active} onClick={onClick}>{inner}</GlassOption>;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active ? "bg-[rgba(var(--brand-rgb),0.25)] text-content-primary font-medium" : "text-content-tertiary hover:bg-fill-subtle hover:text-content-primary"
      }`}
    >
      <span className={`h-2 w-2 flex-shrink-0 rounded-full transition-colors ${active ? "bg-tentacle-accent shadow-[0_0_6px_rgba(var(--brand-rgb), 0.6)]" : "bg-fill-medium"}`} />
      {inner}
    </button>
  );
}

function Badge({ color, children }: { color: "purple" | "zinc" | "amber"; children: React.ReactNode }) {
  // Verre : un trait plein — l'aplat translucide d'avant rendrait gris sur la surface à alpha.
  const glass = isGlassLayout(usePlayerGlassMode());
  if (glass) return <GlassChip>{children}</GlassChip>;
  const cls = color === "purple"
    ? "bg-[rgba(var(--brand-rgb),0.2)] text-[var(--brand-light)]"
    : color === "amber"
      ? "bg-amber-500/20 text-amber-300"
      : "bg-fill-soft text-content-tertiary";
  return <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}
