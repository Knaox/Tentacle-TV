import type { CSSProperties, ReactNode } from "react";
import type { AudioLabel, MediaQuality } from "../../lib/mediaQuality";

/**
 * Système de méta-tokens unifié — source unique de vérité pour la qualité
 * (4K / 1080P / VISION / HDR / ATMOS) et les langues audio (VF / VOSTFR / JP…).
 *
 * Principe : un seul chip monochrome en verre sombre, discret, cohérent avec
 * le thème glassmorphique. Le SEUL accent coloré est réservé au 4K (teinte
 * violette brand très légère). Tout le reste reste neutre pour ne pas
 * dénaturer l'affiche. Plus de drapeaux, plus de gradients holographiques.
 */

type Tone = "glass" | "accent" | "lang";

const TONE_STYLE: Record<Tone, CSSProperties> = {
  glass: {
    background: "rgba(12,12,18,0.55)",
    color: "rgba(255,255,255,0.82)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.13)",
  },
  // 4K : unique signal "premium" — teinte brand subtile + halo soft.
  accent: {
    background: "linear-gradient(180deg, rgba(42,28,70,0.72) 0%, rgba(22,14,40,0.82) 100%)",
    color: "#ffffff",
    boxShadow: "inset 0 0 0 1px rgba(167,139,250,0.5), 0 0 10px rgba(var(--brand-rgb),0.28)",
  },
  // Langues : même verre, texte légèrement plus discret que la qualité.
  lang: {
    background: "rgba(12,12,18,0.55)",
    color: "rgba(255,255,255,0.72)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
  },
};

interface MetaChipProps {
  children: ReactNode;
  tone?: Tone;
  title?: string;
  ariaLabel?: string;
}

export function MetaChip({ children, tone = "glass", title, ariaLabel }: MetaChipProps) {
  return (
    <span
      title={title}
      aria-label={ariaLabel ?? title}
      className="inline-flex items-center whitespace-nowrap rounded-[5px] px-1.5 py-[2px] text-[10px] font-semibold uppercase leading-none tracking-[0.1em] backdrop-blur-md"
      style={{ ...TONE_STYLE[tone], textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
    >
      {children}
    </span>
  );
}

/**
 * Pastille unique regroupant toutes les langues audio en texte
 * (« VF · JP », « VOSTFR », « VF · EN »). Une seule pastille au lieu de N
 * drapeaux empilés.
 */
export function LanguagePill({ labels, max = 3 }: { labels: AudioLabel[]; max?: number }) {
  if (labels.length === 0) return null;
  const shown = labels.slice(0, max);
  const full = shown.map((l) => l.full).join(", ");
  return (
    <MetaChip tone="lang" title={full} ariaLabel={`Langues : ${full}`}>
      {shown.map((l) => l.token).join(" · ")}
    </MetaChip>
  );
}

/** True si au moins un marqueur qualité affichable est présent. */
export function hasQualityChips(q: MediaQuality): boolean {
  return Boolean(q.resolution || q.isDolbyVision || q.isHDR || q.isDolbyAtmos);
}

/** Tokens qualité en texte brut (ex. ["4K", "VISION"]) — pour un rendu sobre. */
export function getQualityTokens(q: MediaQuality): string[] {
  const out: string[] = [];
  if (q.resolution === "4K") out.push("4K");
  else if (q.resolution === "FHD") out.push("1080P");
  else if (q.resolution === "HD") out.push("720P");
  if (q.isDolbyVision) out.push("VISION");
  else if (q.isHDR) out.push("HDR");
  if (q.isDolbyAtmos) out.push("ATMOS");
  return out;
}

/**
 * Méta condensée en une chaîne sobre : « 4K · VISION · VF·EN ».
 * Qualité et langues séparées par « · », les langues restant groupées.
 */
export function soberMetaText(q: MediaQuality): string {
  const parts: string[] = [];
  const quality = getQualityTokens(q);
  if (quality.length) parts.push(quality.join(" · "));
  const langs = q.audioLabels.map((l) => l.token);
  if (langs.length) parts.push(langs.join("·"));
  return parts.join(" · ");
}

/**
 * Tokens qualité dans l'ordre canonique.
 *  • "full"    → résolution + (VISION|HDR) + ATMOS
 *  • "compact" → UN seul token dominant (4K > VISION > ATMOS > HDR > résolution)
 * HEVC / Dolby Digital volontairement omis (trop techniques, encombrants).
 */
export function QualityChips({
  quality,
  density = "full",
}: {
  quality: MediaQuality;
  density?: "full" | "compact";
}) {
  const { resolution, isDolbyVision, isHDR, isDolbyAtmos } = quality;

  if (density === "compact") {
    if (resolution === "4K") return <MetaChip tone="accent" ariaLabel="Ultra HD 4K">4K</MetaChip>;
    if (isDolbyVision) return <MetaChip title="Dolby Vision">Vision</MetaChip>;
    if (isDolbyAtmos) return <MetaChip title="Dolby Atmos">Atmos</MetaChip>;
    if (isHDR) return <MetaChip>HDR</MetaChip>;
    if (resolution === "FHD") return <MetaChip>1080P</MetaChip>;
    if (resolution === "HD") return <MetaChip>720P</MetaChip>;
    return null;
  }

  return (
    <>
      {resolution === "4K" && <MetaChip tone="accent" ariaLabel="Ultra HD 4K">4K</MetaChip>}
      {resolution === "FHD" && <MetaChip>1080P</MetaChip>}
      {resolution === "HD" && <MetaChip>720P</MetaChip>}
      {isDolbyVision ? (
        <MetaChip title="Dolby Vision">Vision</MetaChip>
      ) : (
        isHDR && <MetaChip>HDR</MetaChip>
      )}
      {isDolbyAtmos && <MetaChip title="Dolby Atmos">Atmos</MetaChip>}
    </>
  );
}
