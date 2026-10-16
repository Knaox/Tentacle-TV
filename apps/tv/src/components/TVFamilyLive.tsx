import { useFamilyLive, useTentacleConfig } from "@tentacle-tv/api-client";
import { tvSessionMode } from "@tentacle-tv/tv-core";
import { useStoredToken } from "../hooks/useStoredToken";

/**
 * La Famille EN DIRECT pendant une session de profil (Apple TV, Android TV),
 * où qu'on soit : sur `family:update` — un rôle nommé sur le bureau, un droit
 * réglé, un invité créé ailleurs —, tout ce qui vit sous `["family"]` se
 * relit (la vue d'ensemble de « Gérer les profils », la liste relue de « Qui
 * regarde ? » que lisent Réglages › Compte et la garde de Vigie). N'écoutée
 * qu'à « Gérer les profils », la TV gardait le rôle de l'ouverture (constat du
 * 16/10). La socket est la socket PARTAGÉE de l'app ; hors session de profil,
 * rien.
 */
export function TVFamilyLive() {
  const { storage } = useTentacleConfig();
  const token = useStoredToken(storage);
  useFamilyLive({ token, enabled: token !== null && tvSessionMode(storage) === "profile" });
  return null;
}
