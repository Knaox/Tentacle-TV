import { useMemo } from "react";
import type { MusicCapablePlugin } from "@tentacle-tv/shared/music";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { findMusicProvider, type MusicProvider } from "./musicProvider";

/**
 * Le fournisseur de musique hors bibliothèque de CE serveur, ou `null` — la
 * SEULE porte des points d'extension musique côté clients. Rien sans la
 * capacité `plugins.isolatedRuntime` (un serveur d'avant n'a ni relais ni
 * contrat), sans extension active ET configurée qui déclare `music`, ou si le
 * serveur ne la sert pas à ce compte (`/api/plugins/active` est déjà filtré
 * pour lui ; ses routes refusent un compte sans droit, et les crochets se
 * taisent alors). Chaque application passe SA liste d'extensions actives.
 */
export function useMusicProvider(plugins: readonly MusicCapablePlugin[] | null | undefined): MusicProvider | null {
  const capable = useServerCapability("plugins.isolatedRuntime");
  return useMemo(() => (capable ? findMusicProvider(plugins) : null), [capable, plugins]);
}
