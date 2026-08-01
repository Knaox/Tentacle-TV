/**
 * Ce qu'il faut poser sur TOUTE requête qui ne touche pas le réseau.
 *
 * # Le piège, et il est total
 *
 * TanStack Query a un `networkMode` dont la valeur par défaut est `"online"` :
 * dès que `navigator.onLine` passe à faux, il **met la requête en pause** et
 * n'appelle JAMAIS `queryFn`. C'est un excellent défaut pour une requête HTTP —
 * inutile de partir vers un serveur injoignable — et un défaut catastrophique
 * pour une requête qui interroge le disque local par IPC.
 *
 * Constaté, réseau coupé : `useLocalSource` restait en pause, `isFetched` ne
 * passait jamais à vrai, `waitingLocal` restait donc vrai pour toujours, et le
 * lecteur affichait un chargement INFINI sur un film intégralement présent sur
 * la machine. Même mécanique pour le catalogue hors ligne, pour l'entrée
 * « Téléchargements » du header — dont les droits sont lus dans SQLite — et
 * pour tout ce qui dépend d'une lecture locale.
 *
 * Le symptôme est particulièrement retors : la console ne montre RIEN. Une
 * requête en pause n'échoue pas, elle n'est simplement jamais partie. On voit
 * donc le bruit des requêtes réseau qui échouent, et un silence complet là où
 * se trouve le vrai problème.
 *
 * `"always"` dit à TanStack ce qui est vrai : cette requête ne dépend pas du
 * réseau, exécute-la, en ligne comme hors ligne.
 *
 * ⚠️ À ne PAS poser sur une requête qui appelle le serveur : la mise en pause
 * y est le bon comportement, et la retirer ferait tourner des tentatives dans
 * le vide.
 */
export const REQUETE_LOCALE = {
  networkMode: "always",
} as const;
