import { useState } from "react";
import { useInViewport } from "../../hooks/useInViewport";

interface CardImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Fallback rendered when the image fails to load. */
  fallback?: React.ReactNode;
  /**
   * Zoom interne au survol de la carte parente. À couper (`false`) dès qu'un
   * panneau d'aperçu prend le relais du survol.
   *
   * C'était LA cause de la saccade ressentie sur les vignettes 16:9 : la carte
   * commençait un zoom de 6 % sur 300 ms, et 110 ms plus tard le panneau
   * peignait la MÊME image à l'échelle 1 par-dessus. Le contenu reculait donc
   * d'un coup en pleine course — deux images du même média à deux cadrages
   * différents, ce qui se lit exactement comme « une carte se met par-dessus
   * l'ancienne ». Aucun réglage de durée ou de délai ne pouvait le corriger :
   * il fallait supprimer l'un des deux mouvements.
   */
  zoom?: boolean;
}

/**
 * Lazy-loaded image with shimmer skeleton + graceful error fallback.
 * Used by both PosterCard and EpisodeCard.
 */
export function CardImage({ src, alt, className, fallback, zoom = true }: CardImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  // Le squelette n'est monté que si la carte est REGARDÉE.
  //
  // Sans cette garde, les cartes situées hors du champ horizontal d'une rangée
  // gardaient un squelette animé pour toujours : leur image est en
  // `loading="lazy"`, elle n'est donc jamais demandée tant qu'on n'a pas fait
  // défiler la rangée, et `loaded` restait faux indéfiniment. Sur sept rangées,
  // cela faisait une quarantaine d'animations infinies invisibles — de quoi
  // empêcher le compositeur de se rendormir et le GPU de redescendre en veille,
  // en permanence, sur une page où rien ne bouge.
  //
  // `useInViewport` répond VRAI par défaut : avant le premier passage de
  // l'observateur, on préfère afficher un squelette pour rien que risquer un
  // trou blanc là où une image se charge.
  const { ref: boxRef, visible } = useInViewport<HTMLDivElement>();

  return (
    <div ref={boxRef} className={`relative h-full w-full overflow-hidden ${className ?? ""}`}>
      {!loaded && !errored && visible && (
        <div className="absolute inset-0 skeleton-shimmer" aria-hidden />
      )}
      {!errored && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          // Décodage HORS du fil principal. Sans cet attribut, transformer les
          // octets d'une affiche en pixels se fait sur le fil qui gère aussi le
          // défilement — et l'accueil en aligne une centaine, décodées au fil
          // de l'arrivée des réponses réseau, c'est-à-dire exactement pendant
          // qu'on parcourt les rangées. Aucun effet visuel : l'image apparaît
          // quand elle est prête, comme avant.
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          // Zoom interne discret au survol de la carte parente (`group/card`) —
          // le conteneur masque le débord (overflow-hidden côté carte).
          className={`h-full w-full object-cover motion-reduce:!transform-none ${
            zoom ? "group-hover/card:scale-[1.06]" : ""
          }`}
          style={{
            opacity: loaded ? 1 : 0,
            transition: "opacity 240ms ease-out, transform 300ms var(--ease-out)",
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

function FallbackIcon() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}
