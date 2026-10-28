import { OctaveRoute } from "@/octave/route/OctaveRoute";

/** Octave — une playlist d'une extension, par sa clé `ext:` (écran du registre : `externalPlaylist`). */
export default function OctaveScreenRoute() {
  return <OctaveRoute name="externalPlaylist" />;
}
