import { useEffect, useState } from "react";
import { useInViewport } from "@/hooks/useInViewport";
import type { ResumeFrame } from "@/hooks/useResumeFrame";
import { knownImage, rememberImage } from "./seenImages";
import { cropTrickplayTile, croppedTile } from "./trickplayTile";

interface CardTrickplayImageProps {
  frame: ResumeFrame;
  alt: string;
  /** La bannière habituelle de la carte, rendue si la planche ne vient pas. */
  fallback: React.ReactNode;
  /** Zoom au survol sur le web ; une dalle n'a pas de survol. */
  zoom?: boolean;
}

/**
 * La vignette de reprise, DÉCOUPÉE une fois pour toutes dans sa planche.
 *
 * Le web affiche la planche trickplay entière — dix vignettes sur dix —
 * décalée derrière un cadre qui n'en laisse voir qu'une. Sur la dalle, une
 * planche de 3200 × 1800 pèse 23 Mo une fois décodée : cinq cartes « Reprendre »
 * débordaient le cache de décodage du processeur graphique, et chaque
 * rastérisation redécodait les planches l'une après l'autre. Mesuré sur la C3 :
 * masquer ces seules planches retirait un tiers de la latence d'un appui.
 *
 * Ici la case voulue est extraite hors du fil principal (`trickplayTile.ts`)
 * et la carte affiche une image de la taille d'UNE vignette : les mêmes pixels
 * au même cadrage — la boîte a le ratio de la vignette et couvre la carte
 * 16:9, comme sur le web —, pour un centième de la mémoire.
 *
 * Même discipline que `CardImageTv` : demandée au montage, fondu à la première
 * arrivée seulement.
 */
export function CardTrickplayImage({ frame, alt, fallback }: CardTrickplayImageProps) {
  const key = `${frame.url}#${frame.col}:${frame.row}`;
  const [state, setState] = useState(() => initial(key));
  if (state.key !== key) setState(initial(key));
  const { url, loaded, errored, instant } = state;
  const { ref: boxRef, visible } = useInViewport<HTMLDivElement>();

  useEffect(() => {
    if (url || errored) return;
    let alive = true;
    cropTrickplayTile(frame).then(
      (cropped) => alive && setState((e) => (e.key === key ? { ...e, url: cropped } : e)),
      () => alive && setState((e) => (e.key === key ? { ...e, errored: true } : e)),
    );
    return () => {
      alive = false;
    };
  }, [key, url, errored, frame]);

  // La boîte au ratio d'UNE vignette, qui couvre la carte 16:9 (cf. le web).
  const thumbRatio = frame.info.Width / frame.info.Height;
  const boxSize = thumbRatio >= 16 / 9
    ? { height: "100%", width: `${(thumbRatio / (16 / 9)) * 100}%` }
    : { width: "100%", height: `${(16 / 9 / thumbRatio) * 100}%` };

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden">
      {!loaded && !errored && visible && (
        <div className="absolute inset-0 skeleton-shimmer" aria-hidden />
      )}
      {url && !errored && (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{
            opacity: loaded ? 1 : 0,
            transition: instant ? undefined : "opacity 240ms ease-out",
          }}
        >
          <img
            src={url}
            alt=""
            decoding="async"
            draggable={false}
            className="relative max-w-none flex-none"
            style={boxSize}
            onLoad={() => {
              rememberImage(url);
              setState((e) => (e.key === key ? { ...e, loaded: true } : e));
            }}
            onError={() => setState((e) => (e.key === key ? { ...e, errored: true } : e))}
          />
        </div>
      )}
      {errored && <div className="absolute inset-0">{fallback}</div>}
    </div>
  );
}

function initial(key: string) {
  // Déjà découpée, et encore retenue (`seenImages`) : affichée d'emblée, sans
  // fondu. Découpée mais relâchée, elle refait son entrée plutôt que de
  // surgir une image plus tard.
  const url = croppedTile(key);
  const ready = url !== null && knownImage(url);
  return { key, url, loaded: ready, errored: false, instant: ready };
}
