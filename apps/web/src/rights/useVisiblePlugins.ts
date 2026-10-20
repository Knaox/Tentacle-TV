import { mayShow, useAccountAbilities } from "@tentacle-tv/api-client";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";

/**
 * Les extensions actives que la SESSION voit — ce que le serveur en dit
 * (`account.abilities` › `extensions`, relu à `rights:changed`) : un invité de
 * la Famille sans « peut demander des films » n'en voit aucune (ni entrée de
 * navigation, ni page, ni « Demander » sur les cartes). Le serveur refuse de
 * toute façon leurs routes ; l'interface ne les propose plus. Face à un serveur
 * qui ne le dit pas : la liste telle quelle, comme avant.
 */
const NONE: ReturnType<typeof useActivePluginsMeta> = [];

export function useVisiblePlugins(): ReturnType<typeof useActivePluginsMeta> {
  const plugins = useActivePluginsMeta();
  return mayShow(useAccountAbilities(), "extensions") ? plugins : NONE;
}
