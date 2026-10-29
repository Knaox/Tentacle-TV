/**
 * Bureau — les liens `tentacle://octave/<page>` que le système remet à l'app (playlist partagée, page d'ouverture
 * d'un serveur) : la coquille les transmet bruts (`app_link_take` au montage, l'évènement `app-link` ensuite,
 * `apps/desktop-electron/src/main/appLinks.ts`) ; la page n'ouvre que les pages admises par la règle partagée
 * (`octaveOpenTarget`), en mode Octave, une fois la session prête. Hors du bureau : rien.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { octaveOpenTarget } from "@tentacle-tv/shared/octave/mode";
import { invoke, isElectronShell, listen } from "./bridge";
import { setOctaveMode } from "../music/octave/mode/octaveMode";

export function useDesktopAppLinks(ready: boolean): void {
  const navigate = useNavigate();
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectronShell()) return;
    let active = true;
    let unlisten: (() => void) | undefined;
    const accept = (raw: unknown) => {
      const target = typeof raw === "string" ? octaveOpenTarget(raw) : null;
      if (active && target) setPath(target);
    };
    // Une coquille d'avant n'a pas la commande : le refus est silencieux.
    invoke<string | null>("app_link_take").then(accept, () => undefined);
    listen<string>("app-link", (event) => accept(event.payload)).then(
      (un) => (active ? (unlisten = un) : un()),
      () => undefined,
    );
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!ready || !path) return;
    setOctaveMode(true);
    navigate(path);
    setPath(null);
  }, [navigate, path, ready]);
}
