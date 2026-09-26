import { useEffect, useRef, useState } from "react";
import { useInViewport } from "@/hooks/useInViewport";
import { knownImage, rememberImage } from "./seenImages";

/** Mêmes délais que la carte du web — la raison est écrite là-bas. */
const RETRY_DELAYS_MS = [2_000, 8_000];
const MAX_RETRIES = RETRY_DELAYS_MS.length;
const REENTRY_RETRY_MIN_MS = 5_000;

interface CardImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  /** Zoom au survol sur le web ; une dalle n'a pas de survol. */
  zoom?: boolean;
}

/**
 * L'image d'une carte, pour un téléviseur.
 *
 * Même rendu que `CardImage` — squelette pendant le chargement, fondu à
 * l'arrivée, repli et réessais bornés — moins deux choses qui faisaient
 * « réapparaître » les cartes pendant qu'on parcourt l'accueil.
 *
 * **L'image est demandée dès que la carte est montée.** Le web attend qu'elle
 * passe à 400 px de l'écran. Mais la marge d'un observateur n'élargit que la
 * fenêtre du document, pas le rognage de la piste qui défile : une carte
 * d'avance, cachée par le bord droit de la rangée, n'était JAMAIS « proche »
 * — son image partait au moment précis où elle entrait dans le champ. Ici le
 * nombre de cartes montées est déjà borné par le fenêtrage des rangées : il
 * n'y a rien de plus à retenir.
 *
 * **Une image déjà vue dans la session s'affiche d'emblée.** Une rangée vidée
 * puis remplie remonte ses cartes, et chaque image repartait d'une opacité
 * nulle pour refaire son fondu — un parcours rapide faisait donc clignoter
 * tout ce qu'on venait de voir. Le fondu reste réservé à la PREMIÈRE arrivée.
 */
export function CardImage({ src, alt, className, fallback }: CardImageProps) {
  const [state, setState] = useState(() => initial(src));
  if (state.src !== src) setState(initial(src));
  const { loaded, errored, attempt, instant } = state;
  const errorAtRef = useRef(0);
  // Le squelette n'anime que ce qu'on regarde (cf. la carte du web).
  const { ref: boxRef, visible } = useInViewport<HTMLDivElement>();

  useEffect(() => {
    if (!errored || src === "" || attempt >= MAX_RETRIES) return;
    const timer = setTimeout(() => {
      setState((e) =>
        e.src === src && e.errored ? { ...e, errored: false, attempt: e.attempt + 1 } : e,
      );
    }, RETRY_DELAYS_MS[attempt]);
    return () => clearTimeout(timer);
  }, [errored, attempt, src]);

  // La chance du retour à l'écran, comme sur le web.
  const prevVisibleRef = useRef(visible);
  useEffect(() => {
    const was = prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (!visible || was || src === "") return;
    setState((e) => {
      if (e.src !== src || !e.errored) return e;
      if (e.attempt < MAX_RETRIES) return e;
      if (Date.now() - errorAtRef.current < REENTRY_RETRY_MIN_MS) return e;
      return { ...e, errored: false };
    });
  }, [visible, src]);

  return (
    <div ref={boxRef} className={`relative h-full w-full overflow-hidden ${className ?? ""}`}>
      {!loaded && !errored && visible && (
        <div className="absolute inset-0 skeleton-shimmer" aria-hidden />
      )}
      {!errored && (
        <img
          src={src}
          alt={alt}
          decoding="async"
          draggable={false}
          onLoad={() => {
            rememberImage(src);
            setState((e) => (e.src === src ? { ...e, loaded: true } : e));
          }}
          onError={() => {
            errorAtRef.current = Date.now();
            setState((e) => (e.src === src ? { ...e, errored: true } : e));
          }}
          className="h-full w-full object-cover"
          style={{
            opacity: loaded ? 1 : 0,
            transition: instant ? undefined : "opacity 240ms ease-out",
          }}
        />
      )}
      {errored && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2 text-content-quaternary">
          {fallback ?? <FallbackIcon />}
        </div>
      )}
    </div>
  );
}

function initial(src: string) {
  // Déjà arrivée une fois : affichée tout de suite, sans fondu ni squelette.
  const instant = src !== "" && knownImage(src);
  return { src, loaded: instant, errored: src === "", attempt: 0, instant };
}

function FallbackIcon() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}
