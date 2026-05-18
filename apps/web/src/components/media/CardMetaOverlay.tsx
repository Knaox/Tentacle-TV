import { useMemo, type ReactElement } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { extractMediaQuality } from "../../lib/mediaQuality";
import { CountryFlag } from "./CountryFlag";

interface Props {
  item: MediaItem;
  /**
   * • "full" (défaut) — tous les marqueurs détectés (jusqu'à 5 chips + 4
   *   drapeaux). Convient aux landscape (EpisodeCard) et au poster de la
   *   page Detail qui ont la largeur pour absorber.
   * • "compact" — UN seul chip premium dominant (4K > DV > ATMOS > HDR)
   *   + UN seul drapeau (audio par défaut). Pour les portraits étroits
   *   (PosterCard) où l'empilement noyait l'affiche.
   */
  density?: "full" | "compact";
}

/** Cap visuel : au-delà de 4 drapeaux la stack bouffe la card. */
const MAX_FLAGS = 4;

/**
 * Overlay miniature — premium markers en top-left, drapeaux en TOP-RIGHT
 * (avant : bottom-left, mais ça chevauchait le titre d'épisode sur les
 * EpisodeCard 16:9 — top-right ne touche aucun texte sur les deux cards).
 *
 * Chips premium dans l'ordre 4K → HEVC → DV → HDR → ATMOS → DD :
 *  • DD masqué si ATMOS présent (Atmos > DD côté qualité).
 *  • HDR masqué si DV présent (DV est un sur-ensemble HDR).
 *  • Ni 1080p, 720p ni codec H264 ne sont affichés (trop techniques).
 *
 * Memoization : extractMediaQuality est ref-stable tant que React Query ne
 * mute pas l'item en place, donc le useMemo s'invalide correctement.
 */
export function CardMetaOverlay({ item, density = "full" }: Props) {
  const quality = useMemo(() => extractMediaQuality(item), [item]);
  const { resolution, isHEVC, isHDR, isDolbyVision, isDolbyAtmos, isDolbyDigital, audioFlags } = quality;
  const compact = density === "compact";

  const flags = compact ? audioFlags.slice(0, 2) : audioFlags.slice(0, MAX_FLAGS);
  const chips = compact ? renderCompactChip(quality) : renderFullChips(quality);
  const hasChip = chips.length > 0;

  // En compact : on ne montre RIEN si ni 4K/DV/Atmos/HDR ni résolution
  // détectable — pour 1080P seul on n'envahit pas la card (le user verra le
  // détail en allant sur la page Detail).
  const compactWorth =
    resolution === "4K" || isDolbyVision || isDolbyAtmos || isHDR || isDolbyDigital || isHEVC;
  if (compact && !compactWorth && flags.length === 0) return null;
  if (!compact && !hasChip && flags.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-1.5 top-1.5 z-10 flex flex-col items-start gap-1">
      {hasChip && <div className="flex flex-wrap items-center gap-1">{chips}</div>}
      {flags.length > 0 && (
        <div
          className="flex flex-col gap-0.5"
          aria-label={`Langues audio : ${flags.map((f) => f.languageCode.toUpperCase()).join(", ")}`}
        >
          {flags.map((f) => (
            <CountryFlag
              key={`${f.countryCode}-${f.secondaryCountryCode ?? ""}`}
              code={f.countryCode}
              secondary={f.secondaryCountryCode}
              languageCode={f.languageCode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Mode "full" — tous les marqueurs (jusqu'à 5 chips dans l'ordre canonique). */
function renderFullChips(q: ReturnType<typeof extractMediaQuality>): ReactElement[] {
  const out: ReactElement[] = [];
  if (q.resolution === "4K") out.push(<PremiumChip key="4k" label="4K" tone="accent" />);
  else if (q.resolution === "FHD") out.push(<PremiumChip key="fhd" label="1080P" tone="glass" />);
  else if (q.resolution === "HD") out.push(<PremiumChip key="hd" label="720P" tone="glass" />);
  if (q.isHEVC) out.push(<PremiumChip key="hevc" label="HEVC" tone="glass" title="HEVC / H.265" />);
  if (q.isDolbyVision) out.push(<DolbyChip key="dv" label="VISION" />);
  else if (q.isHDR) out.push(<PremiumChip key="hdr" label="HDR" tone="glass" />);
  if (q.isDolbyAtmos) out.push(<DolbyChip key="atmos" label="ATMOS" />);
  else if (q.isDolbyDigital) out.push(<DolbyChip key="dd" label="DIGITAL" />);
  return out;
}

/** Mode "compact" — UN seul chip dominant. Priorité 4K > DV > ATMOS > HDR. */
function renderCompactChip(q: ReturnType<typeof extractMediaQuality>): ReactElement[] {
  if (q.resolution === "4K") return [<PremiumChip key="4k" label="4K" tone="accent" />];
  if (q.isDolbyVision) return [<DolbyChip key="dv" label="VISION" />];
  if (q.isDolbyAtmos) return [<DolbyChip key="atmos" label="ATMOS" />];
  if (q.isHDR) return [<PremiumChip key="hdr" label="HDR" tone="glass" />];
  return [];
}

// Composants exportés pour réutilisation (HeroContent les rend inline dans
// la ligne meta, pas en overlay absolu). Garde-fou unique source de vérité.
export { PremiumChip, DolbyChip };

/**
 * Chip Dolby — mime le wordmark officiel (double-D mark à gauche + label
 * condensé en blanc). Pas le logo trademarked exact mais visuellement
 * reconnaissable comme du "Dolby" pour l'utilisateur. SVG inline, scale-clean.
 */
function DolbyChip({ label }: { label: "VISION" | "ATMOS" | "DIGITAL" }) {
  return (
    <span
      title={`Dolby ${label}`}
      aria-label={`Dolby ${label}`}
      className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-[2px] text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md"
      style={{
        background: "linear-gradient(180deg, rgba(20,20,30,0.85) 0%, rgba(6,6,12,0.92) 100%)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.55), inset 0 0 0 1px var(--border-strong)",
        textShadow: "0 1px 2px rgba(0,0,0,0.45)",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Double-D mark Dolby : deux "D" miroir, simplifiés en SVG. */}
      <svg width="14" height="10" viewBox="0 0 28 20" aria-hidden className="shrink-0">
        <path
          d="M3 2h7c4 0 7 3.6 7 8s-3 8-7 8H3V2zm22 16h-7c-4 0-7-3.6-7-8s3-8 7-8h7v16z"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
        />
      </svg>
      <span className="opacity-95">{label}</span>
    </span>
  );
}

/**
 * Chip premium unifié.
 *  • tone="accent" → traitement façon Netflix "4K UHD" mais en couleurs
 *    Tentacle : fond noir profond, "4K" blanc + micro-label "UHD" gris clair,
 *    fine barre violette brand en pied (au lieu du rouge Netflix) + glow
 *    violet soft autour. Sobre, premium, parfaitement aligné design system.
 *  • tone="glass"  → verre sombre neutre (1080P / 720P / HEVC / HDR)
 */
function PremiumChip({
  label,
  tone,
  title,
}: {
  label: string;
  tone: "accent" | "glass";
  title?: string;
}) {
  if (tone === "accent") return <FourKBadge label={label} title={title} />;
  return (
    <span
      title={title}
      aria-label={title ?? label}
      className="inline-flex items-center rounded-[4px] px-1.5 py-[2px] text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur-md"
      style={{
        background: "linear-gradient(180deg, rgba(20,20,30,0.78) 0%, rgba(8,8,15,0.86) 100%)",
        color: "rgba(255,255,255,0.92)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.55), inset 0 0 0 1px var(--border-strong)",
        textShadow: "0 1px 2px rgba(0,0,0,0.45)",
      }}
    >
      {label}
    </span>
  );
}

/**
 * Badge 4K — single line aligné parfaitement sur les autres chips (HEVC /
 * DV / etc.). On distingue le 4K avec :
 *   • fond verre noir LÉGÈREMENT teinté violet brand (au lieu du noir pur
 *     des autres chips) → discret mais identifiable au coup d'œil
 *   • bordure inset violette plus marquée (vs blanc 16% pour les autres)
 *   • soft glow violet autour
 *   • "4K" en blanc font-black, même taille que les labels des peers
 * Plus de stack vertical "4K / UHD" qui cassait l'alignement.
 */
function FourKBadge({ label, title }: { label: string; title?: string }) {
  return (
    <span
      title={title ?? "Ultra HD 4K"}
      aria-label={title ?? "Ultra HD 4K"}
      className="inline-flex items-center rounded-[4px] px-1.5 py-[2px] text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-md"
      style={{
        background:
          "linear-gradient(180deg, rgba(45,28,75,0.85) 0%, rgba(20,12,40,0.92) 100%)",
        boxShadow:
          "0 2px 10px rgba(var(--brand-rgb), 0.45), inset 0 0 0 1px rgba(167,139,250,0.55)",
        textShadow: "0 1px 2px rgba(0,0,0,0.55)",
      }}
    >
      {label}
    </span>
  );
}
