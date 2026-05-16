import type { MediaQuality } from "../../lib/mediaQuality";

interface Props {
  quality: MediaQuality;
  /** Compact mode pour les cards (icône réduite, espacement serré). */
  compact?: boolean;
}

/**
 * Ensemble de badges qualité affichés en overlay sur l'affiche d'un média :
 *  • 4K → traitement premium (gradient holographique + soft glow + shine)
 *  • HDR / FHD / HD → chip discret en verre
 *  • Dolby Vision / Dolby Atmos → wordmark "DOLBY •|•" stylisé
 *
 * Ordre d'affichage : qualité vidéo dominante en premier, Dolby ensuite.
 * Rien n'est rendu si aucune info exploitable n'est disponible.
 */
export function PremiumQualityBadges({ quality, compact = false }: Props) {
  const { resolution, isHDR, isDolbyVision, isDolbyAtmos } = quality;
  const hasAny = resolution || isHDR || isDolbyVision || isDolbyAtmos;
  if (!hasAny) return null;

  return (
    <div className={`flex flex-wrap items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      {resolution === "4K" && <UltraHDBadge compact={compact} />}
      {resolution && resolution !== "4K" && <ResolutionChip label={resolution} compact={compact} />}
      {isHDR && !isDolbyVision && <FeatureChip label="HDR" tone="amber" compact={compact} />}
      {isDolbyVision && <DolbyMark label="VISION" compact={compact} />}
      {isDolbyAtmos && <DolbyMark label="ATMOS" compact={compact} />}
    </div>
  );
}

/**
 * 4K "incroyable" — gradient holographique + halo soft + reflet animé.
 * Pure CSS (pas d'image), respecte prefers-reduced-motion.
 */
function UltraHDBadge({ compact }: { compact: boolean }) {
  const padding = compact ? "px-2 py-0.5" : "px-2.5 py-1";
  const fontSize = compact ? "text-[10px]" : "text-xs";
  return (
    <span
      className={`relative inline-flex items-center gap-1 overflow-hidden rounded-md ${padding} ${fontSize} font-black uppercase tracking-[0.14em] text-white shadow-[0_4px_18px_rgba(245,158,11,0.45),0_0_0_1px_rgba(255,255,255,0.18)_inset]`}
      style={{
        background:
          "linear-gradient(135deg, #FACC15 0%, #F59E0B 35%, #D97706 55%, #8B5CF6 100%)",
        textShadow: "0 1px 2px rgba(0,0,0,0.45)",
      }}
      aria-label="Ultra HD 4K"
    >
      <span className="relative z-10">4K</span>
      <span className={`relative z-10 ${compact ? "text-[8px]" : "text-[9px]"} font-bold opacity-85`}>
        ULTRA HD
      </span>
      {/* Reflet diagonal qui balaie ~3s, en boucle. Désactivé en reduced-motion. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 motion-reduce:hidden"
        style={{
          background:
            "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)",
          animation: "qualityShine 3.4s ease-in-out infinite",
        }}
      />
    </span>
  );
}

function ResolutionChip({ label, compact }: { label: string; compact: boolean }) {
  const padding = compact ? "px-1.5 py-0.5" : "px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center rounded-md ${padding} text-[10px] font-bold uppercase tracking-wider text-white/85 ring-1 ring-white/25 backdrop-blur-md`}
      style={{ background: "rgba(15,15,25,0.55)" }}
    >
      {label}
    </span>
  );
}

function FeatureChip({
  label,
  tone,
  compact,
}: {
  label: string;
  tone: "amber" | "purple";
  compact: boolean;
}) {
  const padding = compact ? "px-1.5 py-0.5" : "px-2 py-0.5";
  const palette =
    tone === "amber"
      ? { bg: "rgba(245,158,11,0.18)", ring: "rgba(245,158,11,0.45)", color: "rgb(252,211,77)" }
      : { bg: "rgba(139,92,246,0.18)", ring: "rgba(139,92,246,0.45)", color: "rgb(196,181,253)" };
  return (
    <span
      className={`inline-flex items-center rounded-md ${padding} text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur-md`}
      style={{
        background: palette.bg,
        boxShadow: `inset 0 0 0 1px ${palette.ring}`,
        color: palette.color,
        textShadow: "0 1px 2px rgba(0,0,0,0.35)",
      }}
    >
      {label}
    </span>
  );
}

/**
 * Wordmark Dolby discret — fond verre sombre, "DOLBY" + séparateur pipe + label.
 * Inspiration : badge Apple TV / Netflix (typo serrée, capitales fines).
 */
function DolbyMark({ label, compact }: { label: "VISION" | "ATMOS"; compact: boolean }) {
  const padding = compact ? "px-1.5 py-0.5" : "px-2 py-0.5";
  const fontSize = compact ? "text-[9px]" : "text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md ${padding} ${fontSize} font-semibold uppercase tracking-[0.16em] text-white/95 ring-1 ring-white/20 backdrop-blur-md`}
      style={{
        background: "linear-gradient(180deg, rgba(20,20,30,0.78) 0%, rgba(8,8,15,0.85) 100%)",
        textShadow: "0 1px 2px rgba(0,0,0,0.45)",
      }}
      aria-label={`Dolby ${label}`}
    >
      <span className="font-black">DOLBY</span>
      <span className="opacity-50">·</span>
      <span className="opacity-95">{label}</span>
    </span>
  );
}
