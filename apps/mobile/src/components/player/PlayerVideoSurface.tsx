import { MpvVideoSurface } from "@/player/engine/MpvVideoSurface";
import { NativeVideoSurface } from "@/player/engine/NativeVideoSurface";
import type { EngineSurfaceProps } from "@/player/engine/types";
import { useDisplayModeMatch } from "@/player/engine/useDisplayModeMatch";

export type PlayerVideoSurfaceProps = EngineSurfaceProps;

/**
 * La surface vidéo du lecteur mobile : le répartiteur entre le lecteur
 * système (`NativeVideoSurface`) et le lecteur avancé (`MpvVideoSurface`).
 * Les écrans ne connaissent pas le moteur : ils passent le même contrat et
 * reçoivent les mêmes événements. L'écran se cale ici sur la cadence du film,
 * pour les deux moteurs (Android).
 */
export function PlayerVideoSurface(props: PlayerVideoSurfaceProps) {
  useDisplayModeMatch(props.streams);
  return props.engine === "mpv" ? <MpvVideoSurface {...props} /> : <NativeVideoSurface {...props} />;
}
