import { useTranslation } from "react-i18next";
import { Play, X } from "lucide-react";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { useViewport } from "../../useFormFactor";
import { useIsTablet } from "../../useMirrorLayout";
import { PLAYER } from "../playerColors";
import { episodeCode } from "../playerMetrics";
import { OverlayPill } from "./OverlayPill";
import { useArmedCountdown } from "./useArmedCountdown";
import { useEntered } from "./useEntered";

interface Props {
  nextEpisode: MediaItem;
  /** Secondes restantes ; `null` = offre sans minuterie. */
  countdownSeconds: number | null;
  countdownTotalMs: number;
  /** L'habillage est à l'écran : la carte remonte de 72. */
  controlsVisible: boolean;
  onPlay: () => void;
  onDismiss: () => void;
}

/** Surface OPAQUE de la carte — `surface-modal` du web, jamais de flou sur la vidéo. */
const CARD_BG = "rgba(15, 15, 21, 0.96)";

/**
 * La carte « à suivre » DE COIN pendant le générique — `UpNextCardMobile` de
 * l'app : `min(340 | 420, W − 32)` de large, coin bas-droit à
 * `max(16, encoche + 12)`, rayon 16, vignette 16:7 fondue dans la surface,
 * pastille « À suivre », croix ronde de 40, eyebrow « S01E02 » 11 px, titre
 * 15 px, et la pilule pleine largeur dont le balayage montre le temps qui
 * reste. Elle remonte de 72 quand l'habillage est à l'écran.
 */
export function UpNextCard({ nextEpisode, countdownSeconds, countdownTotalMs, controlsVisible, onPlay, onDismiss }: Props) {
  const { t } = useTranslation("player");
  const client = useJellyfinClient();
  const isTablet = useIsTablet();
  const { width } = useViewport();
  const entered = useEntered();
  const armed = useArmedCountdown(countdownSeconds, countdownTotalMs);

  const thumbUrl = client.getImageUrl(nextEpisode.Id, "Primary", { width: 500, quality: 85 });
  const label = nextEpisode.Type === "Episode" ? episodeCode(nextEpisode.ParentIndexNumber, nextEpisode.IndexNumber) : null;
  const inset = "env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)";
  const lift = (entered ? 0 : 8) + (controlsVisible ? -72 : 0);

  return (
    <div
      className="pointer-events-auto absolute transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
      style={{
        zIndex: 55,
        bottom: "max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))",
        right: "max(16px, calc(env(safe-area-inset-right, 0px) + 12px))",
        width: `min(${isTablet ? 420 : 340}px, calc(${width}px - ${inset} - 32px))`,
        opacity: entered ? 1 : 0,
        transform: `translateY(${lift}px)`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="overflow-hidden" style={{ borderRadius: 16, backgroundColor: CARD_BG, border: "1px solid rgba(255, 255, 255, 0.14)" }}>
        <div className="relative" style={{ aspectRatio: "16 / 7", backgroundColor: "#16131c" }}>
          <img src={thumbUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(15,15,21,0.55) 55%, rgba(15,15,21,0.96) 100%)" }}
          />
          <div
            className="absolute flex flex-row items-center rounded-full"
            style={{
              top: 10, left: 10, gap: 6, paddingInline: 10, paddingBlock: 5,
              backgroundColor: "rgba(0, 0, 0, 0.72)", border: "1px solid rgba(255, 255, 255, 0.16)",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.9)" }} />
            <span style={{ color: PLAYER.text, fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase" }}>
              {t("upNext")}
            </span>
          </div>
          <button
            type="button"
            aria-label={t("dismiss")}
            onClick={onDismiss}
            className="absolute flex items-center justify-center active:opacity-75 [-webkit-tap-highlight-color:transparent]"
            style={{ top: 6, right: 6, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0, 0, 0, 0.55)" }}
          >
            <X size={18} color={PLAYER.text} />
          </button>
        </div>

        <div className="flex flex-col" style={{ padding: 14, paddingTop: 10, gap: 8 }}>
          {label && (
            <span style={{ color: PLAYER.textTertiary, fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase" }}>
              {label}
            </span>
          )}
          <span className="line-clamp-2" style={{ color: PLAYER.text, fontSize: 15, fontWeight: 700 }}>{nextEpisode.Name}</span>
          <OverlayPill
            key={armed?.key ?? "manual"}
            label={countdownSeconds !== null ? t("playNowIn", { seconds: countdownSeconds }) : t("playNow")}
            onPress={onPlay}
            countdownMs={armed?.remainingMs ?? null}
            initialProgress={armed?.initialProgress ?? 0}
            fullWidth
            icon={<Play size={15} color={PLAYER.textInverse} fill={PLAYER.textInverse} />}
          />
        </div>
      </div>
    </div>
  );
}
