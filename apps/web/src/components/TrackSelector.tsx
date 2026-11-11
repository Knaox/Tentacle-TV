import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
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
import { PANEL_MOTION } from "./player/chrome/panelMotion";
import { PanelHeader } from "./player/chrome/PanelHeader";
import { SeriesKeepRow } from "./player/chrome/SeriesKeepRow";
import "./player/chrome/playerPanels.css";

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
  /** Épisode : « Garder pour toute la série » (préférence de langues). */
  applyToSeries?: ApplyToSeriesControl;
  /** Le nom de la série, pour la phrase de « Garder pour toute la série ». */
  seriesName?: string;
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
  onAudioChange, onSubtitleChange, onQualityChange, onClose, applyToSeries, seriesName,
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
  // « Garder pour toute la série » suit les sous-titres : il porte sur l'audio et les
  // sous-titres, pas sur la qualité.
  const series = applyToSeries && <SeriesKeepRow control={applyToSeries} seriesName={seriesName} />;
  const sections = (
    <>
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

      {series && (
        <>
          <div className="ui-menu-separator" />
          {series}
          {onQualityChange && <div className="ui-menu-separator" />}
        </>
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
            <p className="mt-1 flex items-start gap-1.5 px-2.5 pb-1 text-xs leading-relaxed text-content-tertiary">
              <span className="font-semibold text-accent">{t("player:qualityAutoBadge")}</span>
              <span>{t(dropText.menuKey, dropText.values)}</span>
            </p>
          )}
        </Section>
      )}
    </>
  );
  // Verre : le popover au-dessus de la capsule (`GlassPanel`) — même titre, mêmes marges,
  // mêmes lignes que le menu sans verre (lot rf2 : seul le matériau change).
  if (glass) {
    return (
      <GlassPanel morphId={PLAYER_MORPH.tracks} className="lgp-menu w-80" bodyClassName="lgp-menu__body" role="dialog" aria-label={t("player:chrome.tracksTitle")}>
        <PanelHeader title={t("player:chrome.tracksTitle")} onClose={onClose} />
        <div className="pl-panel__scroll">{sections}</div>
      </GlassPanel>
    );
  }
  return (
    <motion.div data-panneau-detache
      {...PANEL_MOTION}
      role="dialog" aria-label={t("player:chrome.tracksTitle")}
      className="pl-panel ui-menu w-80"
      onClick={(e) => e.stopPropagation()}
    >
      <PanelHeader title={t("player:chrome.tracksTitle")} onClose={onClose} />
      <div className="pl-panel__scroll">{sections}</div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const glass = isGlassLayout(usePlayerGlassMode());
  return (
    <div role="group" aria-label={title}>
      <p className={glass ? "lgp-section-title" : "ui-menu-label"}>{title}</p>
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
  return <MenuOption active={active} onClick={onClick}>{inner}</MenuOption>;
}

function TrackOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { lang, codec, title } = parseTrackLabel(label);
  const glass = isGlassLayout(usePlayerGlassMode());
  // Le nom d'abord ; la langue et le codec à droite, en encre discrète — ils précisent, ils ne
  // concurrencent pas le nom (la coche dit seule le choix).
  const meta = [lang, codec].filter(Boolean).join(" · ");
  const inner = (
    <>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {meta && <span className="pl-option__meta">{meta}</span>}
    </>
  );
  // Verre : la même ligne, sur la matière native (`.lgp-option`).
  if (glass) return <GlassOption active={active} onClick={onClick}>{inner}</GlassOption>;
  return <MenuOption active={active} onClick={onClick}>{inner}</MenuOption>;
}

/**
 * Une ligne de choix du panneau (refonte de nov. 2026) : l'entrée de menu du socle, et la COCHE
 * à la teinte franche pour dire l'option retenue — plus d'aplat ni de point lumineux de marque.
 */
function MenuOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={active} onClick={onClick} className="ui-menu-item pl-option">
      <span className="pl-option__check" aria-hidden>{active && <CheckIcon size={16} weight="bold" />}</span>
      {children}
    </button>
  );
}

function Badge({ color, children }: { color: "purple" | "zinc" | "amber"; children: React.ReactNode }) {
  // Verre : un trait plein — l'aplat translucide d'avant rendrait gris sur la surface à alpha.
  const glass = isGlassLayout(usePlayerGlassMode());
  if (glass) return <GlassChip>{children}</GlassChip>;
  // Une puce du socle : la teinte franche pour ce qui qualifie le choix (langue, Auto, Dolby
  // Vision), l'ambre pour la plage et le son étendus, l'encre pour le reste.
  const skin = color === "purple" ? "chip-accent" : color === "amber" ? "chip-warning" : "";
  return <span className={`chip flex-shrink-0 ${skin}`}>{children}</span>;
}
