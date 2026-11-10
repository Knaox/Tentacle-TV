/**
 * Octave — le bouton RETOUR d'une vue qui n'est pas une racine (album, artiste, playlist, ambiance,
 * mix, profils) : le bouton du socle (`BackButton`), branché sur l'historique d'Octave. Il revient
 * d'où l'on vient DANS le mode ; ouverte par un lien direct (rien derrière dans Octave), la vue mène
 * à l'accueil d'Octave — jamais hors du mode (en sortir est le geste de la bascule), jamais nulle part.
 * ‹ › du rail restent : ce bouton-ci est là où l'œil le cherche, en tête de la page.
 */

import { createContext, memo, useCallback, useContext, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../../components/ui/BackButton";
import { octavePaths } from "../octavePaths";
import { OctaveHistoryContext, useOctaveHistory, useOwnOctaveHistory } from "./useOctaveHistory";

/** Pose l'historique de la coquille pour tout ce qu'elle contient (‹ ›, bouton Retour des vues). */
export function OctaveHistoryScope({ children }: { children: ReactNode }) {
  const history = useOwnOctaveHistory();
  return <OctaveHistoryContext.Provider value={history}>{children}</OctaveHistoryContext.Provider>;
}

export const OctaveBackButton = memo(function OctaveBackButton({ className = "", onMedia = false }: { className?: string; onMedia?: boolean }) {
  const { canBack, back } = useOctaveHistory();
  const navigate = useNavigate();
  const onBack = useCallback(() => {
    if (canBack) back();
    else navigate(octavePaths.home, { replace: true });
  }, [back, canBack, navigate]);
  return <BackButton onBack={onBack} onMedia={onMedia} className={className} />;
});

const SubviewContext = createContext(false);

/** Cette vue est-elle sous une rangée « Retour » (`OctaveSubview`) ? Sa tête resserre alors sa marge du haut. */
export function useOctaveSubview(): boolean {
  return useContext(SubviewContext);
}

/**
 * Une vue qui n'est PAS une racine de navigation : le bouton Retour en tête, dans TOUS ses états
 * (attente, erreur, contenu) — posé une fois, à la route, jamais vue par vue.
 */
export function OctaveSubview({ children }: { children: ReactNode }) {
  return (
    <SubviewContext.Provider value={true}>
      <div className="relative z-[1] px-4 pt-4 md:px-8" data-octave-back-row>
        <OctaveBackButton />
      </div>
      {children}
    </SubviewContext.Provider>
  );
}
