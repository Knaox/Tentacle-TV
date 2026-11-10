/**
 * Ce que le banc met à la place de `src/main.tsx`. Des modules d'Octave en importent `backendUrl`
 * (`offline/connectivityStore.ts`…) : dans l'application, c'est son point d'entrée ; ici, le suivre
 * exécuterait TOUTE l'application (son rendu, sa garde de session, ses requêtes) dans la page du
 * banc. Le banc n'a aucun serveur : adresse vide, comme le web servi par son serveur.
 */

export const backendUrl = "";

export function configureBackendUrls(_url: string): void {
  /* Aucun serveur à configurer. */
}
