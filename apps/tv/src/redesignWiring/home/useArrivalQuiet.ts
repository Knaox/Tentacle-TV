import { useEffect, useState } from "react";
import { HOME_ARRIVAL_QUIET_MS } from "@tentacle-tv/tv-core";

/**
 * L'accueil arrivé depuis « Qui regarde ? » (`entrance`) fond par-dessus le
 * profil qui s'est avancé : pendant ce fondu et un court instant après, son
 * « Chargement… » se tait (vrai tant qu'il se tait) — un panneau en
 * surimpression de l'avatar brouillait l'entrée. Au-delà, le panneau revient :
 * jamais un écran vide qui dure.
 */
export function useArrivalQuiet(entrance: boolean): boolean {
  const [quiet, setQuiet] = useState(entrance);
  useEffect(() => {
    if (!entrance) return undefined;
    const timer = setTimeout(() => setQuiet(false), HOME_ARRIVAL_QUIET_MS);
    return () => clearTimeout(timer);
  }, [entrance]);
  return quiet;
}
