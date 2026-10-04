import { createContext, useContext, type ReactNode } from "react";
import { BASE_REMOTE_HINTS, type RemoteHints } from "@tentacle-tv/tv-core";

/**
 * Les mots qui nomment une touche, vus par les vues de la refonte — la table
 * de la télécommande de la plateforme (`RemoteBindings.hints`, tv-core).
 *
 * Les vues ne connaissent pas la plateforme : l'app pose le fournisseur à sa
 * racine (`App.tsx`, avec la table de `platform/input`) ; sans lui — le banc —
 * ce sont les mots de la Siri Remote, ceux d'avant la table.
 */

const RemoteHintsContext = createContext<RemoteHints>(BASE_REMOTE_HINTS);

export function RemoteHintsProvider({ hints, children }: { hints: RemoteHints; children: ReactNode }) {
  return <RemoteHintsContext.Provider value={hints}>{children}</RemoteHintsContext.Provider>;
}

/** Les clés i18n des indications de touches : `t(useRemoteHints().holdForOptions)`. */
export function useRemoteHints(): RemoteHints {
  return useContext(RemoteHintsContext);
}
