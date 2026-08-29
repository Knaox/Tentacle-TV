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

export type PairingState = "chargement" | "code" | "expire" | "erreur";

export interface RelayPairing {
  state: PairingState;
  code: string | null;
  /** Secondes restantes, et la durée initiale pour la jauge. */
  remaining: number;
  duration: number;
  /** Redemande un code. Sert au bouton de reprise comme à l'expiration. */
  regenerate: () => void;
}

/** Le relais annonce la durée de vie ; ce repli ne sert que s'il l'omet. */
const DEFAULT_DURATION = 300;

export function usePairingRelay(
  onConfirmed: (data: RelayStatusResponse) => void,
): RelayPairing {
  const generation = useRelayGenerate();
  const [code, setCode] = useState<string | null>(null);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [remaining, setRemaining] = useState(DEFAULT_DURATION);
  const [issuedAt, setIssuedAt] = useState<number | null>(null);

  const expire = remaining <= 0;
  const { data: status } = useRelayStatus(code && !expire ? code : null);

  // `mutate` change d'identité à chaque rendu de la mutation : le mémoriser
  // évite que `regenerate` — et donc l'effet de montage — ne se recrée en
  // boucle, ce qui redemanderait un code à chaque sondage.
  const request = useRef(generation.mutate);
  request.current = generation.mutate;

  const regenerate = useCallback(() => {
    setCode(null);
    setIssuedAt(null);
    setRemaining(DEFAULT_DURATION);
    request.current(undefined, {
      onSuccess: (data) => {
        const lifetime = data.expiresIn > 0 ? data.expiresIn : DEFAULT_DURATION;
        setCode(data.code);
        setDuration(lifetime);
        setRemaining(lifetime);
        setIssuedAt(Date.now());
      },
    });
  }, []);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  /* Le décompte se calcule sur l'HORLOGE, pas en soustrayant une seconde par
     battement : un téléviseur suspend volontiers ses minuteurs quand l'appli
     passe en arrière-plan, et un compteur décrémenté aurait alors du retard sur
     le relais — il annoncerait un code encore valide là où il ne l'est plus. */
  useEffect(() => {
    if (issuedAt === null) return;
    const ticker = setInterval(() => {
      const elapsed = Math.floor((Date.now() - issuedAt) / 1000);
      setRemaining(Math.max(0, duration - elapsed));
    }, 1000);
    return () => clearInterval(ticker);
  }, [issuedAt, duration]);

  useEffect(() => {
    if (status?.status === "confirmed") onConfirmed(status);
    if (status?.status === "expired") setRemaining(0);
  }, [status, onConfirmed]);

  let state: PairingState = "chargement";
  if (code && !expire) state = "code";
  else if (code && expire) state = "expire";
  else if (generation.isError) state = "erreur";

  return { state, code, remaining, duration, regenerate };
}
