import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { PROBE_EVERY_MS, type Culprit } from "@tentacle-tv/tv-core";
import { publishPlaybackTrouble, readPlaybackTrouble } from "./playbackTroubleStore";
import type { RecoverySources } from "./usePlaybackRecovery";
import { probeStreamPath } from "../utils/streamPathProbe";
import { plog } from "../utils/playerDiag";

/**
 * L'OUVERTURE ratée pendant une panne (avant la première image) : on dit qui
 * manque (`startCulprit`, lu par l'écran d'échec), et on relance l'ouverture
 * dès son retour — sondes du chemin du flux toutes les 5 s, rien d'autre.
 *
 * Seulement si une sonde l'a vu à terre : un échec serveur joignable n'est pas
 * une panne, et relancer en boucle un titre illisible ne servirait à rien.
 *
 * Au retour, la FICHE du titre d'abord : manquée pendant la panne, elle
 * laissait l'ouverture sans pistes ni reprise — mesuré : 3 s du début en
 * transcodage, puis la bascule en lecture directe à la bonne position. Son
 * arrivée relance déjà la résolution du flux ; sinon, « Réessayer ».
 */
export function useStartupRecovery(sources: RecoverySources | undefined): void {
  const client = useJellyfinClient();
  const queryClient = useQueryClient();
  const src = useRef(sources);
  src.current = sources;
  const startFailed = !!sources && sources.p.failed && !sources.s.hasStarted;

  useEffect(() => {
    if (!startFailed) return undefined;
    let cancelled = false;
    let culprit: Culprit | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = async () => {
      const result = await probeStreamPath(client);
      if (cancelled) return;
      if (!result.ok) {
        culprit = result.culprit;
        publishPlaybackTrouble({ ...readPlaybackTrouble(), startCulprit: culprit });
        timer = setTimeout(() => { void check(); }, PROBE_EVERY_MS);
        return;
      }
      if (!culprit) return;
      plog("recover", `ouverture ratée pendant la panne (${culprit}) : le serveur répond, nouvelle ouverture`);
      await queryClient.refetchQueries({ queryKey: ["item"], type: "active" }).catch(() => undefined);
      if (!cancelled && src.current?.p.failed) src.current.p.setReloadNonce((n) => n + 1);
    };
    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      publishPlaybackTrouble({ ...readPlaybackTrouble(), startCulprit: null });
    };
  }, [startFailed, client, queryClient]);
}
