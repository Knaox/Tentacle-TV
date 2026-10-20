import { useEffect } from "react";
import { useFamilyLive, useTentacleConfig } from "@tentacle-tv/api-client";
import { sameUserId } from "@tentacle-tv/shared";
import { honorTvPromptsReset, readProfileRecord, tvSessionMode } from "@tentacle-tv/tv-core";
import { useStoredToken } from "../hooks/useStoredToken";
import { useTvFamilyListing } from "../redesignWiring/profiles/useTvFamilyListing";
import { railPinningStore } from "./nav/railPinning";

/**
 * La Famille EN DIRECT pendant une session de profil (Apple TV, Android TV),
 * où qu'on soit : sur `family:update` — un rôle nommé sur le bureau, un droit
 * réglé, un invité créé ailleurs —, tout ce qui vit sous `["family"]` se
 * relit (la vue d'ensemble de « Gérer les profils », la liste relue de « Qui
 * regarde ? » que lisent Réglages › Compte et la garde de Vigie). N'écoutée
 * qu'à « Gérer les profils », la TV gardait le rôle de l'ouverture (constat du
 * 16/10). La socket est la socket PARTAGÉE de l'app ; hors session de profil,
 * rien.
 *
 * « Reproposer le code PIN et la photo » demandé PENDANT la session (ou pour
 * un profil retenu, qui se reprend sans repasser par l'ouverture) : la liste
 * relue en porte la date, la TV oublie ses « Plus tard » pour ce profil. Rien
 * ne paraît en cours de route — les fenêtres du démarrage sont déjà passées —,
 * les étapes reviennent au prochain lancement.
 */
export function TVFamilyLive() {
  const { storage } = useTentacleConfig();
  const token = useStoredToken(storage);
  useFamilyLive({ token, enabled: token !== null && tvSessionMode(storage) === "profile" });

  const listing = useTvFamilyListing();
  useEffect(() => {
    const record = readProfileRecord(storage);
    const open = record ? listing?.profiles.find((profile) => sameUserId(profile.userId, record.profileId)) : undefined;
    if (open && honorTvPromptsReset(storage, open)) railPinningStore.reopenSetup(open.userId);
  }, [listing, storage]);
  return null;
}
