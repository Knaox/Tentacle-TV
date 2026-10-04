import { useMemo } from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useTentacleConfig, useTitlesAccess } from "@tentacle-tv/api-client";
import { titleProvider, uiLanguage, type TitlePlatform } from "@tentacle-tv/shared";
import { MY_TITLES_REFRESH, profileMayRequest, readProfileRecord, tvTitlesGate, type TvTitlesGate } from "@tentacle-tv/tv-core";
import { useActivePlugins } from "./useActivePlugins";

/**
 * LA garde des fonctions de Vigie sur la TV — « Demander », la recherche hors
 * bibliothèque, les demandes en cours : tout ou rien (`titlesFeaturesOpen`,
 * tv-core). Rien n'est codé pour Vigie ici : c'est le serveur qui déclare
 * l'extension (contrat `titles`, droit du compte `titles.access`), et c'est
 * cette déclaration qui branche ses fonctions. Serveur ou Vigie d'avant ce
 * contrat, compte bloqué dans Vigie (le compte de démonstration de la revue
 * Apple), droit pas encore lu : `null`, et aucune trace dans l'app.
 *
 * Le seul endroit où le cœur intègre une fonction de Vigie (CLAUDE.md, règle
 * « Demander ») : tout ce qui en dépend passe par ici, rien ailleurs.
 *
 * La garde porte aussi l'ORIGINE des demandes de cette TV (`tvTitlesGate`,
 * tv-core) : toute demande qui en part dit « tv » et sa plateforme, et
 * « Mes demandes » ne montre que les demandes faites depuis une TV.
 *
 * Famille (Apple TV) : un profil INVITÉ la trouve fermée, sauf si son
 * propriétaire lui a permis de demander (`profileMayRequest`, tv-core).
 */

/** L'extension, la langue de l'interface (celle des titres que Vigie renvoie), l'origine des demandes. */
export type VigieGate = TvTitlesGate;

/** La TV qui demande : la même app tourne sur l'Apple TV et sur l'Android TV. */
const TV_PLATFORM: TitlePlatform = Platform.OS === "ios" ? "appletv" : "androidtv";

export function useVigieGate(): VigieGate | null {
  const { i18n } = useTranslation();
  const { storage } = useTentacleConfig();
  const mayRequest = profileMayRequest(readProfileRecord(storage));
  const lang = uiLanguage(i18n.language);
  const plugins = useActivePlugins();
  // Un invité sans droit : pas même la question du droit au serveur.
  const provider = useMemo(() => (plugins && mayRequest ? titleProvider(plugins) : null), [plugins, mayRequest]);
  const access = useTitlesAccess(provider, { staleTimeMs: MY_TITLES_REFRESH.accessMs });
  return useMemo(() => tvTitlesGate(provider, access, lang, TV_PLATFORM, mayRequest), [provider, access, lang, mayRequest]);
}
