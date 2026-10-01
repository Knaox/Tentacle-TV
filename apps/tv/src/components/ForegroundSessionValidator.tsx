import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { runAuthRefreshFlow } from "../auth/sessionFlow";
import { wakeRevocationDrain } from "../auth/revocationQueue";

/** Validateur de session au retour au premier plan.
 *  Sur Android TV, l'app peut rester en arrière-plan plusieurs heures (utilisateur
 *  qui change de source HDMI). Au retour, on revalide silencieusement le token,
 *  et les révocations encore en attente repartent.
 *
 *  Précautions critiques :
 *  - On ne valide QUE sur une vraie transition `background|inactive → active`,
 *    PAS au tout premier event (qui peut être spurious au cold start sur certaines
 *    builds Android TV) — sinon, force-stop puis relance redirige sur Login.
 *  - On utilise `softFail: true` : si tout échoue on garde la session, on laisse
 *    le seuil 5×401 du JellyfinClient arbitrer si une vraie déconnexion s'impose.
 *  Extrait d'`App.tsx` (budget de 300 lignes). */
export function ForegroundSessionValidator() {
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const previousStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const previous = previousStateRef.current;
      previousStateRef.current = state;

      // Ne valide que les transitions background|inactive → active.
      // Le cold start envoie souvent un event "active" depuis un état initial
      // déjà "active" ou "unknown" — on ignore.
      if (state !== "active") return;
      if (previous === "active" || previous === "unknown") return;

      wakeRevocationDrain();
      if (!storage.getItem("tentacle_token") || !storage.getItem("tentacle_server_url")) return;
      void runAuthRefreshFlow(client, storage, queryClient, { softFail: true });
    });
    return () => sub.remove();
  }, [client, storage, queryClient]);
  return null;
}
