import { useCallback, useState } from "react";
import { useInViewport } from "../../hooks/useInViewport";
import { useNearViewport } from "../../hooks/useNearViewport";
import type { ResumeFrame } from "../../hooks/useResumeFrame";

interface CardTrickplayImageProps {
  frame: ResumeFrame;
  alt: string;
  /**
   * Rendu quand la planche ne charge pas — la bannière habituelle de la carte,
   * qui porte sa propre discipline de réessai. Pas de réessai ICI : l'échec
   * d'une planche immuable veut dire proxy ou réseau à terre, et le repli
   * couvre le visuel ; une nouvelle position (donc une nouvelle URL) remet le
   * compteur à zéro.
   */
  fallback: React.ReactNode;
  /** Zoom interne au survol de la carte parente (cf. `CardImage`). */
  zoom?: boolean;
}

/**
 * La vignette de reprise, CROPPÉE dans sa planche trickplay.
 *
 * Même discipline que `CardImage` — squelette seulement quand la carte est
 * regardée, requête seulement près du viewport (400 px), fondu à l'arrivée —
 * mais le rendu est un sprite : la planche entière (10×10 vignettes) se
 * positionne en pourcentages autour d'une boîte au ratio d'UNE vignette,
 * forcée à COUVRIR la carte 16:9 (les vignettes scope débordent en largeur et
 * se rognent au centre, comme `object-cover`).
 *
 * Tout est en pourcentages : la carte est responsive, aucune mesure en pixels.
 * La planche est servie `immutable` un an par le proxy — une carte affichée
 * deux fois ne redemande rien, et la même planche resservira à l'aperçu de la
 * barre de progression du lecteur.
 */
export function CardTrickplayImage({ frame, alt, fallback, zoom = true }: CardTrickplayImageProps) {
  // L'état est attaché à l'ADRESSE : les cartes sont recyclées au défilement,
  // et la position de reprise change l'URL (cf. `CardImage` pour le pourquoi).
  const [state, setState] = useState({ url: frame.url, loaded: false, errored: false });
  if (state.url !== frame.url) setState({ url: frame.url, loaded: false, errored: false });
  const { loaded, errored } = state;

  const { ref: boxRef, visible } = useInViewport<HTMLDivElement>();
  const { ref: nearRef, near } = useNearViewport<HTMLDivElement>("400px");
  const setBox = useCallback(
    (el: HTMLDivElement | null) => {
      boxRef(el);
      nearRef(el);
    },
    [boxRef, nearRef],
  );

  // La vignette est-elle plus LARGE que la carte 16:9 ? Décide de l'axe qui
  // colle à la carte : l'autre déborde et se rogne au centre.
  const coverByHeight = frame.info.Width / frame.info.Height >= 16 / 9;

  return (
    <div ref={setBox} className="relative h-full w-full overflow-hidden">
      {!loaded && !errored && visible && (
        <div className="absolute inset-0 skeleton-shimmer" aria-hidden />
      )}
      {!errored && near && (
        <div
          role="img"
          aria-label={alt}
          className={`absolute inset-0 flex items-center justify-center overflow-hidden motion-reduce:!transform-none ${
            zoom ? "group-hover/card:scale-[1.06]" : ""
          }`}
          style={{
            opacity: loaded ? 1 : 0,
            transition: "opacity 240ms ease-out, transform 300ms var(--ease-out)",
          }}
        >
          <div
            className="relative flex-none overflow-hidden"
            style={{
              ...(coverByHeight ? { height: "100%" } : { width: "100%" }),
              aspectRatio: `${frame.info.Width} / ${frame.info.Height}`,
            }}
          >
            {/* `max-w-none` : le preflight plafonne les <img> à 100 % — ici la
                planche fait TileWidth × la boîte, elle DOIT déborder. */}
            <img
              src={frame.url}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={() => setState((e) => (e.url === frame.url ? { ...e, loaded: true } : e))}
              onError={() => setState((e) => (e.url === frame.url ? { ...e, errored: true } : e))}
              className="absolute max-w-none"
              style={{
                width: `${frame.info.TileWidth * 100}%`,
                height: `${frame.info.TileHeight * 100}%`,
                left: `${-frame.col * 100}%`,
                top: `${-frame.row * 100}%`,
              }}
            />
          </div>
        </div>
      )}
      {errored && <div className="absolute inset-0">{fallback}</div>}
    </div>
  );
}
