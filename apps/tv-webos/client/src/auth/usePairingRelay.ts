import { useCallback, useEffect, useRef, useState } from "react";
import { useRelayGenerate, useRelayStatus } from "@tentacle-tv/api-client";
import type { RelayStatusResponse } from "@tentacle-tv/api-client";

/**
 * Le jumelage par relais, vu du CLIENT.
 *
 * La coquille sait déjà faire cela, et il a longtemps semblé qu'elle était la
 * seule à le pouvoir : elle interroge le relais sans connaître l'adresse du
 * serveur, ce que le client ne peut pas faire puisqu'il en est servi.
 *
 * **Mais quand on DÉJUMELLE, le serveur est connu** — c'est celui qui sert la
 * page. Il n'y a donc aucune raison de renvoyer l'utilisateur vers la coquille,
 * ce qu'aucun chemin ne permettait de toute façon : mesuré sur l'émulateur,
 * chaque retour en arrière est ravalé par la garde de session, qui repose sur
 * l'écran de connexion avec un `replace`. Le bouton ne pouvait que fermer
 * l'application, et c'est ce qu'il faisait.
 *
 * Ce hook porte donc le même cycle que `RelayCodeDisplay` d'Android TV :
 * demander un code, décompter, sonder, et rendre ce que le relais a confirmé.
 * Il ne range rien lui-même — c'est l'appelant qui décide quoi faire du jeton,
 * parce que le serveur confirmé peut ne pas être celui qui sert la page.
 */

export type EtatJumelage = "chargement" | "code" | "expire" | "erreur";

export interface JumelageRelais {
  etat: EtatJumelage;
  code: string | null;
  /** Secondes restantes, et la durée initiale pour la jauge. */
  restant: number;
  duree: number;
  /** Redemande un code. Sert au bouton de reprise comme à l'expiration. */
  regenerer: () => void;
}

/** Le relais annonce la durée de vie ; ce repli ne sert que s'il l'omet. */
const DUREE_PAR_DEFAUT = 300;

export function useJumelageRelais(
  surConfirmation: (donnees: RelayStatusResponse) => void,
): JumelageRelais {
  const generation = useRelayGenerate();
  const [code, setCode] = useState<string | null>(null);
  const [duree, setDuree] = useState(DUREE_PAR_DEFAUT);
  const [restant, setRestant] = useState(DUREE_PAR_DEFAUT);
  const [emisA, setEmisA] = useState<number | null>(null);

  const expire = restant <= 0;
  const { data: statut } = useRelayStatus(code && !expire ? code : null);

  // `mutate` change d'identité à chaque rendu de la mutation : le mémoriser
  // évite que `regenerer` — et donc l'effet de montage — ne se recrée en
  // boucle, ce qui redemanderait un code à chaque sondage.
  const demander = useRef(generation.mutate);
  demander.current = generation.mutate;

  const regenerer = useCallback(() => {
    setCode(null);
    setEmisA(null);
    setRestant(DUREE_PAR_DEFAUT);
    demander.current(undefined, {
      onSuccess: (donnees) => {
        const vie = donnees.expiresIn > 0 ? donnees.expiresIn : DUREE_PAR_DEFAUT;
        setCode(donnees.code);
        setDuree(vie);
        setRestant(vie);
        setEmisA(Date.now());
      },
    });
  }, []);

  useEffect(() => {
    regenerer();
  }, [regenerer]);

  /* Le décompte se calcule sur l'HORLOGE, pas en soustrayant une seconde par
     battement : un téléviseur suspend volontiers ses minuteurs quand l'appli
     passe en arrière-plan, et un compteur décrémenté aurait alors du retard sur
     le relais — il annoncerait un code encore valide là où il ne l'est plus. */
  useEffect(() => {
    if (emisA === null) return;
    const battement = setInterval(() => {
      const ecoule = Math.floor((Date.now() - emisA) / 1000);
      setRestant(Math.max(0, duree - ecoule));
    }, 1000);
    return () => clearInterval(battement);
  }, [emisA, duree]);

  useEffect(() => {
    if (statut?.status === "confirmed") surConfirmation(statut);
    if (statut?.status === "expired") setRestant(0);
  }, [statut, surConfirmation]);

  let etat: EtatJumelage = "chargement";
  if (code && !expire) etat = "code";
  else if (code && expire) etat = "expire";
  else if (generation.isError) etat = "erreur";

  return { etat, code, restant, duree, regenerer };
}
