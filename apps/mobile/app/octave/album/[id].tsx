import { OctaveRoute } from "@/octave/route/OctaveRoute";

/** Octave — un album, par son identifiant Jellyfin ou sa clé `ext:` (écran du registre : `album`). */
export default function OctaveScreenRoute() {
  return <OctaveRoute name="album" />;
}
