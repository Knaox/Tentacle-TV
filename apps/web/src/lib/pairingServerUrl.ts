import { pairingServerUrl } from "@tentacle-tv/shared";
import { isDesktopApp } from "../desktop/bridge";
import { getBackendBase } from "./backendBase";

/**
 * L'adresse par laquelle CE client joint le serveur : la base du bureau
 * (`tentacle_server_url`) ou du build, sinon l'origine de la page — jamais
 * sur le bureau, où l'origine (`tentacle://app`) est propre à l'application.
 */
export function clientServerUrl(): string {
  const base = getBackendBase();
  if (base) return base;
  return isDesktopApp() ? "" : window.location.origin;
}

/**
 * L'adresse à transmettre à la TV au jumelage (règle partagée
 * `pairingServerUrl`) : celle que le serveur annonce, sinon celle du client.
 * `null` : aucune qu'une TV puisse joindre. Un `/api/config` muet n'en décide
 * pas : l'adresse du client vaut encore, l'échec se dira au jumelage.
 * Page du bureau (`pages/PairDevice.tsx`) et miroir (`usePairFlow`).
 */
export async function fetchPairingServerUrl(): Promise<string | null> {
  let advertised: string | null = null;
  try {
    const res = await fetch(`${getBackendBase()}/api/config`);
    if (res.ok) {
      const cfg = (await res.json()) as { publicUrl?: unknown } | null;
      if (typeof cfg?.publicUrl === "string") advertised = cfg.publicUrl;
    }
  } catch {
    /* réseau indisponible — l'adresse du client reste */
  }
  return pairingServerUrl({ advertised, clientServerUrl: clientServerUrl() });
}
