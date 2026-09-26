import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import type { MediaItem } from "@tentacle-tv/shared";
import { SHEET_MAX_WIDTH } from "../../responsive";
import { PLAYER } from "../playerColors";
import { EpisodeList } from "./EpisodeList";

interface Props {
  visible: boolean;
  seriesId: string;
  currentEpisodeId?: string;
  initialSeasonId?: string;
  onClose: () => void;
}

/**
 * Le sélecteur saison / épisode du lecteur — `PlayerEpisodePicker` de l'app :
 * voile `controlBg`, feuille noire qui MONTE du bas (84 % de haut au plus,
 * 520 de large, rayon 18 en haut, filet `borderSubtle`), titre « Saisons et
 * épisodes » 18 gras, croix 22. Choisir un épisode relance le lecteur dessus.
 * Rendue DANS le lecteur (pas de portail) : elle reste visible en plein écran.
 */
export function EpisodePicker({ visible, seriesId, currentEpisodeId, initialSeasonId, onClose }: Props) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(visible);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setShown(true)); });
      return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!mounted) return null;

  const play = (ep: MediaItem) => {
    onClose();
    navigate(`/watch/${ep.Id}`, { replace: true });
  };

  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col" style={{ zIndex: 70 }} onClick={(e) => e.stopPropagation()}>
      <div
        className="absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none"
        style={{ backgroundColor: PLAYER.controlBg, opacity: shown ? 1 : 0 }}
      />
      <button type="button" aria-label={t("close")} className="relative flex-1" onClick={onClose} />
      <div
        role="dialog"
        aria-label={t("seasonsEpisodes")}
        className="relative mx-auto flex w-full flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{
          maxHeight: "84%", maxWidth: SHEET_MAX_WIDTH,
          backgroundColor: PLAYER.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18,
          borderTop: `1px solid ${PLAYER.borderSubtle}`,
          paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "env(safe-area-inset-right, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: `translateY(${shown ? 0 : 100}%)`,
        }}
      >
        <div className="flex flex-row items-center justify-between" style={{ paddingInline: 16, paddingTop: 16, paddingBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: PLAYER.text }}>{t("seasonsEpisodes")}</h2>
          <button type="button" aria-label={t("close")} onClick={onClose} className="relative" style={{ padding: 4 }}>
            <span aria-hidden className="absolute -inset-3" />
            <X size={22} color={PLAYER.text} />
          </button>
        </div>
        <div ref={scrollRef} className="mirror-no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 28 }}>
          <EpisodeList
            seriesId={seriesId}
            currentEpisodeId={currentEpisodeId}
            initialSeasonId={initialSeasonId}
            scrollRef={scrollRef}
            onPlay={play}
          />
        </div>
      </div>
    </div>
  );
}
