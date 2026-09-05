import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { readRecoFilterMirror } from "../../lib/recoFilterStorage";
import { scheduleRecoPrefetch } from "../../lib/recoPrefetch";
import { useOfflineMode } from "../../offline/useOfflineMode";

/**
 * Déclenche le préchargement de la page Recommandations pour la session
 * authentifiée (en temps mort, une fois par compte) — rien en mode Hors
 * ligne. Le compte réactif couvre login, logout et re-login.
 */
export function RecoPrefetchBoot() {
  const qc = useQueryClient();
  const client = useJellyfinClient();
  const userId = useUserId();
  const offline = useOfflineMode();

  useEffect(() => {
    if (!userId || offline) return;
    return scheduleRecoPrefetch({ qc, client, savedFilter: readRecoFilterMirror(userId) }, userId);
  }, [qc, client, userId, offline]);

  return null;
}
