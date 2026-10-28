/**
 * Octave (mobile) — la redirection du lancement en Octave, partie UNE fois de
 * la racine, impérativement, dès que la navigation est prête et le stockage
 * relu : vers la page d'Octave gardée, si l'app s'est ouverte sur son entrée
 * (`/`) avec une session. Jamais un `<Redirect>` dans une coquille : il se
 * relance à chaque rendu (règle : `launchRedirect.ts`).
 */

import { useEffect } from "react";
import { usePathname, useRootNavigationState, useRouter, type Href } from "expo-router";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import { markOctaveReached, takeOctaveLaunchRedirect } from "./octaveLaunch";

interface Props {
  storage: StorageAdapter;
  /** Le stockage est relu. */
  ready: boolean;
}

export function OctaveLaunchRedirect({ storage, ready }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const navReady = Boolean(useRootNavigationState()?.key);

  useEffect(() => {
    if (!ready || !navReady) return;
    // Sans jeton, la garde d'authentification mène à la connexion : Octave n'a rien à ouvrir.
    if (!storage.getItem("tentacle_token")) {
      markOctaveReached();
      return;
    }
    const go = takeOctaveLaunchRedirect(pathname === "/");
    if (go) router.replace(go as Href);
  }, [ready, navReady, pathname, router, storage]);

  return null;
}
