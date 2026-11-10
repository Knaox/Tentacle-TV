import type { ReactNode } from "react";
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

/**
 * Le verre est à 0,72 et non plus 0,55 : posé sur une affiche claire (le haut
 * d'une carte, où le voile ne vaut que 0,1), le texte à 82 % tombait à
 * 3,5:1 sous 10 px — le téléviseur l'avait déjà remonté à 0,92 pour la même
 * raison (`cards-tv.css`). À 0,72, 6:1 sur un blanc pur.
 */
/**
 * Trois tons, une seule peau : la puce sur image du socle. `accent` (le 4K) et `glass` sont en
 * blanc plein, `lang` un cran plus discret — plus de lavis violet ni de halo sur le 4K (un
 * décor), plus de `backdrop-filter` par puce (une passe de composition chacune, sur chaque
 * carte survolée, derrière un voile déjà presque opaque).
 */
const TONE_CLASS: Record<Tone, string> = {
  glass: "",
  accent: "",
  lang: "!text-on-media-secondary",
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
      data-tone={tone}
      className={`lg-meta chip chip-on-media !h-[18px] !px-1.5 !text-[10px] uppercase tracking-[0.08em] ${TONE_CLASS[tone]}`}
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
