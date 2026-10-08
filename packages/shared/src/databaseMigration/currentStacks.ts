/**
 * Les deux piles officielles d'aujourd'hui (`stacks/` du dépôt, sans base de
 * données depuis 1.25) et l'adresse BRUTE de leur fichier — celle que le README
 * et la doc font télécharger. La marche à suivre de l'administration s'en sert
 * pour « passer à la nouvelle pile » une fois la migration confirmée ; le
 * serveur dit laquelle (`newStack`), le web la montre.
 */
export type CurrentStack = "tentacle-full" | "tentacle-only";

export const CURRENT_STACKS: readonly CurrentStack[] = ["tentacle-full", "tentacle-only"];

export function stackComposeUrl(stack: CurrentStack): string {
  return `https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/${stack}/compose.yaml`;
}

/** La commande à copier dans le dossier de la pile : elle REMPLACE son `compose.yaml`. */
export function stackDownloadCommand(stack: CurrentStack): string {
  return `curl -fsSLo compose.yaml ${stackComposeUrl(stack)}`;
}

export function isCurrentStack(value: unknown): value is CurrentStack {
  return value === "tentacle-full" || value === "tentacle-only";
}
