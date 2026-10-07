import { useState } from "react";
import { useServerCapability } from "@tentacle-tv/api-client";
import { AdminSection } from "../admin/kit";
import { SectionError, SectionSkeleton } from "../admin/services/SectionParts";
import { AddressesForm } from "./AddressesForm";
import { RemoteAccessGuide } from "./RemoteAccessGuide";
import { usePublicIp, useRemoteAccess, useSaveRemoteAccess } from "./remoteAccessApi";
import { RemoteGuide } from "./RemoteGuide";
import { RemoteOverview } from "./RemoteOverview";

/**
 * L'accès à distance — le MÊME composant pour la section d'administration
 * (`variant="admin"`, avec le guide au pied) et pour l'étape facultative de
 * l'assistant d'installation (`"wizard"`). Dans l'ordre :
 *
 *  1. l'état en un coup d'œil, en lecture seule (à la maison, hors de la
 *     maison ; HTTPS, CORS de Jellyfin, adresse publique de la box) ;
 *  2. les adresses — les SEULES choses à régler, reprises de 1.23.0 telles
 *     quelles : ce qui est réglé est publié, aucun interrupteur, aucun
 *     mandataire à choisir ;
 *  3. « En savoir plus », replié : mandataire et son exemple, ports de la
 *     box, vérification depuis Internet, plan B, sécurité.
 */
export function RemoteAccessPanel({ variant = "admin" }: { variant?: "admin" | "wizard" }) {
  const query = useRemoteAccess();
  // `mutateAsync` est stable d'un rendu à l'autre : le guide ne se redessine pas pour rien.
  const { mutateAsync: save } = useSaveRemoteAccess();
  const exposure = useServerCapability("admin.remoteExposure");
  const [guideOpen, setGuideOpen] = useState(false);
  // L'adresse publique de la box (un service d'écho, au plus toutes les dix
  // minutes) : seulement s'il y a un lien public à situer, ou le guide ouvert.
  const publicIp = usePublicIp(exposure && (guideOpen || !!query.data?.publicUrl));

  if (query.isPending) {
    return (
      <AdminSection>
        <SectionSkeleton lines={4} />
      </AdminSection>
    );
  }
  if (query.isError || !query.data) {
    return (
      <AdminSection>
        <SectionError onRetry={() => void query.refetch()} />
      </AdminSection>
    );
  }

  const state = query.data;
  const ip = publicIp.data?.v4 ?? publicIp.data?.v6 ?? null;
  return (
    <>
      <RemoteOverview state={state} publicIp={ip} />
      <AddressesForm variant={variant} />
      <RemoteGuide state={state} publicIp={{ report: publicIp.data, loading: publicIp.isPending }} save={save} variant={variant} onOpenChange={setGuideOpen} />
      {variant === "admin" ? <RemoteAccessGuide /> : null}
    </>
  );
}
