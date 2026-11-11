import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import type { PlaybackPreset } from "@tentacle-tv/shared";

/**
 * Le SCHÉMA d'un mode de lecture, sous son nom : une barre de lecture, le passage (l'intro, le
 * générique), et ce que le lecteur en fait — un bouton qui attend (« Me proposer »), un saut
 * (« Faire tout seul »), les deux (« Par défaut »). Un dessin en CSS, immobile : il ne télécharge
 * rien et ne coûte aucune image. Le VRAI bouton du lecteur, avec son décompte, se voit passage
 * par passage sous « Avancé ».
 */

const TRACK = "absolute inset-x-2 top-[14px] h-1 rounded-full bg-fill-strong";
const PASSAGE = "absolute top-[14px] h-1 rounded-full";
const JUMP = "absolute top-1 h-3 rounded-t-[10px] border-2 border-b-0 border-accent";
// Le bouton plein du lecteur, en petit : les jetons du bouton plein (`--cta-primary-*`), fond et encre ensemble.
// Avec `text-surface-1`, l'encre devenait un voile translucide sous le verre natif (`.lg-page` y redéfinit
// `--surface-1`) : un libellé ivoire sur un bouton ivoire.
const BUTTON = "absolute top-[5px] h-5 rounded-chip bg-[var(--cta-primary-bg)] px-1.5 text-[10px] font-bold leading-5 text-[var(--cta-primary-fg)]";

interface PlaybackModeMiniProps {
  preset: PlaybackPreset;
  /** Le libellé du bouton, celui du lecteur (« Passer l'intro »). */
  skipLabel: string;
}

export function PlaybackModeMini({ preset, skipLabel }: PlaybackModeMiniProps) {
  return (
    <span aria-hidden className="relative mt-2 block h-[30px] overflow-hidden rounded-lg bg-fill-subtle">
      <i className={TRACK} />
      {preset === "manual" && (
        <>
          <i className={`${PASSAGE} left-[12%] w-[26%] bg-accent`} />
          <span className={`${BUTTON} right-2`}>{skipLabel}</span>
        </>
      )}
      {preset === "automatic" && (
        <>
          <i className={`${PASSAGE} left-[12%] w-[26%] bg-accent opacity-40`} />
          <i className={`${JUMP} left-[12%] w-[26%]`} />
          <i className={`${PASSAGE} left-[62%] w-[22%] bg-accent opacity-40`} />
          <i className={`${JUMP} left-[62%] w-[22%]`} />
        </>
      )}
      {preset === "default" && (
        <>
          {/* L'intro se passe seule ; le générique de fin se propose. */}
          <i className={`${PASSAGE} left-[8%] w-[20%] bg-accent opacity-40`} />
          <i className={`${JUMP} left-[8%] w-[20%]`} />
          <i className={`${PASSAGE} left-[40%] w-[18%] bg-accent`} />
          <span className={`${BUTTON} right-2`}>{skipLabel}</span>
        </>
      )}
      {preset === "custom" && (
        <>
          <i className={`${PASSAGE} left-[12%] w-[20%] bg-accent`} />
          <i className={`${PASSAGE} left-[52%] w-[16%] bg-accent opacity-40`} />
          <SlidersHorizontalIcon size={16} className="absolute right-2 top-[7px] text-content-secondary" />
        </>
      )}
    </span>
  );
}
