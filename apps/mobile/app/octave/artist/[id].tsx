import { OctaveRoute } from "@/octave/route/OctaveRoute";

/** Octave — un artiste, par son identifiant Jellyfin ou sa clé `ext:` (écran du registre : `artist`). */
export default function OctaveScreenRoute() {
  return <OctaveRoute name="artist" />;
}
