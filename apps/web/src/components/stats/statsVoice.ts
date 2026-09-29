import { createContext, useContext } from "react";

/**
 * La voix des cartes de statistiques : à qui elles parlent, et où mènent
 * leurs titres. Les cartes ne changent pas d'une page à l'autre — seule la
 * voix change :
 *  • le PROPRIÉTAIRE (défaut) : « Vos genres », un titre ouvre sa fiche, un
 *    visage lance la recherche de son nom ;
 *  • la page PUBLIQUE d'un partage : « Ses genres » (l'espace `statsPublic`,
 *    lu avant `stats`, le nom du propriétaire posé sur chaque texte), un titre
 *    ouvre sa fiche publique, un visage ne mène nulle part — le visiteur n'a
 *    pas de session, et rien ne doit lui promettre une lecture.
 */
export interface StatsVoice {
  audience: "owner" | "public";
  /** Les espaces de textes, lus dans l'ordre. */
  namespaces: readonly string[];
  /** Posées sur chaque texte : `name`, le propriétaire, sur la page publique. */
  vars?: Readonly<Record<string, string>>;
  /** La fiche d'un titre de la bibliothèque ; null : le titre ne s'ouvre pas. */
  titleHref: (id: string) => string | null;
  /** Où mène un visage ; null : nulle part. */
  personHref: (name: string) => string | null;
}

export const OWNER_VOICE: StatsVoice = {
  audience: "owner",
  namespaces: ["stats"],
  titleHref: (id) => `/media/${id}`,
  personHref: (name) => `/search?q=${encodeURIComponent(name)}`,
};

const StatsVoiceContext = createContext<StatsVoice>(OWNER_VOICE);

export const StatsVoiceProvider = StatsVoiceContext.Provider;

export function useStatsVoice(): StatsVoice {
  return useContext(StatsVoiceContext);
}
