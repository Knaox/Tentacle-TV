import { useRightsLive, useTentacleConfig } from "@tentacle-tv/api-client";

/**
 * Les droits en direct (`rights:changed`, capacité `rights.live`) : un droit
 * réglé au bureau ou sur le web — bibliothèques, âge, « peut demander » — se
 * voit ici sans redémarrage. Ce qui est à l'écran se relit, le reste est
 * oublié, et les titres gardés hors ligne sont jugés de nouveau
 * (`offline/rights/OfflineRightsSync`). En session de profil, le socket est
 * celui du PROFIL : l'annonce est la sienne. Monté une fois ; ne rend rien.
 */
export function RightsLiveHost() {
  const { storage } = useTentacleConfig();
  useRightsLive({ token: storage.getItem("tentacle_token") });
  return null;
}
