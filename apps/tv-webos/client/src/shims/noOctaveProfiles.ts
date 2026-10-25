/**
 * Les profils dans Octave, absents du téléviseur.
 *
 * La coquille d'Octave (compilée aussi pour la dalle, par `App.tsx`) monte le
 * menu du profil, et son démarrage la feuille du code PIN : la TV LG n'a pas
 * les profils de la Famille. Leur porte (`music/octave/profiles/index.ts`) ne
 * rend rien ici, et ce qu'elle lit — `apps/web/src/profiles/`, que la feuille
 * ne balaie pas — quitte le bundle.
 */
export function OctaveProfileButton(_props: { compact?: boolean }): null {
  return null;
}

export function OctavePinSheet(_props: unknown): null {
  return null;
}

export type OctavePinSheetProps = Record<string, unknown>;
