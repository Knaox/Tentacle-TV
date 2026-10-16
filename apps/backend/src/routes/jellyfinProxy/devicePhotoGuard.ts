import { isDeviceWriteAllowed } from "./deviceWrites";

/**
 * Le compte de DÉMONSTRATION ne change pas sa photo par la TV (décision du
 * 16/10 : il est partagé par les relecteurs d'Apple). Ce garde ne regarde que
 * l'écriture de la photo du compte (`ownPhoto` de `deviceWrites.ts`) ; tout le
 * reste passe tel quel. `allowed` est la règle du serveur
 * (`services/avatars/devicePhotoAllowed.ts`), injectée : ce fichier se teste
 * seul.
 *
 * `null` : la requête passe ; sinon, la raison à journaliser (403).
 */
export async function devicePhotoRefusal(method: string, path: string, allowed: () => Promise<boolean>): Promise<string | null> {
  if (!isAccountPhotoWrite(method, path)) return null;
  return (await allowed()) ? null : "photo refusee : compte de demonstration";
}

/** L'écriture de la photo du compte, telle que `deviceWrites.ts` la permet. */
export function isAccountPhotoWrite(method: string, path: string): boolean {
  return method.toUpperCase() === "POST" && /^Users\/[^/]+\/Images\/Primary$/i.test(path) && isDeviceWriteAllowed(method, path);
}
