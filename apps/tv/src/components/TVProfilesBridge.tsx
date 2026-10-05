import { useEffect } from "react";
import { AppState, InteractionManager } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { enrollIfAnnounced, openOnLaunch } from "../auth/profileEnrollment";

/**
 * Le passage aux PROFILS d'une TV (refonte) jumelée avant la Famille : au
 * démarrage et à chaque retour au premier plan, si le serveur l'annonce
 * désormais, l'échange (`profileEnrollment.ts`), puis le profil qui s'ouvre
 * seul — le propriétaire seul et sans PIN ne voit rien changer ; sinon « Qui
 * regarde ? ». Serveur sans Famille : rien.
 */
export function TVProfilesBridge() {
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();

  useEffect(() => {
    const context = { jfClient, storage, queryClient };
    let running = false;
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        if ((await enrollIfAnnounced(context)) === "enrolled") await openOnLaunch(context);
      } finally {
        running = false;
      }
    };
    const startup = InteractionManager.runAfterInteractions(() => void sync());
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (state) => {
      const back = state === "active" && previous !== "active";
      previous = state;
      if (back) void sync();
    });
    return () => {
      startup.cancel();
      subscription.remove();
    };
  }, [jfClient, storage, queryClient]);

  return null;
}
