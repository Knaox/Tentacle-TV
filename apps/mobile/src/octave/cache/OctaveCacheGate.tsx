/**
 * Octave (mobile) — la porte du cache gardé : les pages de l'identité
 * reviennent dans le cache de requêtes AVANT le premier rendu d'Octave. Au
 * lancement en Octave, la lecture du disque est partie au chargement du
 * JavaScript (`octaveLaunch.ts`) : elle est finie, l'hydratation est SYNCHRONE
 * et la page gardée se peint d'un coup, avant tout réseau. Sinon on attend au
 * plus `HYDRATE_WAIT_MS`. Ensuite, chaque page finie est gardée (mécanique
 * commune au bureau : `@tentacle-tv/api-client`, `octaveCache/`).
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { attachOctaveCache, isOctaveCacheHydrated, octaveCacheBackend, octaveCacheHydration, type OctaveQueryClientLike } from "@tentacle-tv/api-client";
import { markBoot } from "@/bootIntro/bootTimeline";
import { useOctaveColors } from "../theme/octaveColors";
import { currentOctaveOwner } from "./octavePageStore";
import "./sqliteOctaveCache";

export const HYDRATE_WAIT_MS = 200;

export function OctaveCacheGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient() as unknown as OctaveQueryClientLike;
  const colors = useOctaveColors();
  const owner = useMemo(currentOctaveOwner, []);
  const [ready, setReady] = useState(() => {
    if (owner === null) return true;
    // Lecture du démarrage finie : les pages reviennent dans ce tour, avant le premier rendu.
    void octaveCacheHydration(qc, owner);
    return isOctaveCacheHydrated(owner);
  });

  useEffect(() => {
    if (owner === null) return;
    let alive = true;
    let detach: (() => void) | null = null;
    const wait = setTimeout(() => alive && setReady(true), HYDRATE_WAIT_MS);
    void octaveCacheHydration(qc, owner).then((result) => {
      if (!alive) return;
      clearTimeout(wait);
      setReady(true);
      markBoot("octaveCache");
      detach = attachOctaveCache(qc, octaveCacheBackend(), owner, { known: result.known });
    });
    return () => {
      alive = false;
      clearTimeout(wait);
      detach?.();
    };
  }, [qc, owner]);

  return ready ? <>{children}</> : <View style={{ flex: 1, backgroundColor: colors.ink }} />;
}
