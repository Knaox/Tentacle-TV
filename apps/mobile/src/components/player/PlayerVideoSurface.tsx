import { MpvVideoSurface } from "@/player/engine/MpvVideoSurface";
import { NativeVideoSurface } from "@/player/engine/NativeVideoSurface";
import type { EngineSurfaceProps } from "@/player/engine/types";

export type PlayerVideoSurfaceProps = EngineSurfaceProps;

/**
 * La surface vidéo du lecteur mobile : le répartiteur entre le lecteur
 * système (`NativeVideoSurface`) et le lecteur avancé (`MpvVideoSurface`).
 * Les écrans ne connaissent pas le moteur : ils passent le même contrat et
 * reçoivent les mêmes événements.
 */
export function PlayerVideoSurface(props: PlayerVideoSurfaceProps) {
  return props.engine === "mpv" ? <MpvVideoSurface {...props} /> : <NativeVideoSurface {...props} />;
}
