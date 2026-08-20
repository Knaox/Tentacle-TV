/**
 * La session plein écran du LECTEUR : ce que la page ouvre en montant le lecteur,
 * et referme en le quittant.
 *
 * Sortie de `fullscreen.ts`, qui n'a plus à porter que la bascule elle-même :
 * basculer une fenêtre et suivre une lecture sont deux métiers, et le second
 * répond à une question que le premier ne se pose jamais — ce plein écran-là
 * est-il celui du film, ou celui de l'utilisateur ?
 */

import type { BrowserWindow } from "electron";
import { estEnPleinEcran, noterFenetre, PARADE_WINDOWS, quitter } from "./fullscreen";

/**
 * Session plein écran du lecteur : la fenêtre était-elle DÉJÀ en plein écran quand
 * la vidéo a commencé ? `null` = aucune session ouverte.
 *
 * WINDOWS SEUL s'en sert, et pour une seule question : le plein écran à défaire en
 * sortant est-il celui du film, ou celui d'un utilisateur qui parcourait déjà son
 * catalogue ainsi ? Le second ne nous appartient pas.
 *
 * macOS l'ouvre et la referme sans jamais la consulter — il n'y a plus rien à y
 * décider (voir `fermerSessionLecteur`). Elle reste commune parce que le contrat
 * avec la page l'est : `player_fullscreen_enter` rend l'état courant sur les deux.
 */
let sessionLecteur: { dejaEnPleinEcran: boolean } | null = null;

/**
 * Ouvre la session, et rend l'état COURANT du plein écran.
 *
 * ⚠️ Ouverte UNE SEULE FOIS, et c'est le point délicat — sous Windows, où elle
 * décide encore de quelque chose. Un changement d'épisode remonte le lecteur
 * (`key={itemId}`) alors que la fenêtre, elle, reste en plein écran : relire son
 * état à ce moment-là ferait conclure que le plein écran était celui de
 * l'utilisateur, et la fenêtre ne redescendrait plus jamais.
 *
 * La valeur RENDUE, elle, est bien celle de l'instant : c'est elle qui amorce
 * l'état React du lecteur, à chaque montage.
 *
 * La fenêtre est passée en argument plutôt que déduite : la mémoire de
 * `fullscreen.ts` n'est posée que par NOS bascules, et une fenêtre mise en plein
 * écran au bouton vert avant même d'ouvrir un film y aurait été comptée pour
 * fenêtrée.
 */
export function ouvrirSessionLecteur(win: BrowserWindow): boolean {
  noterFenetre(win);
  const enPleinEcran = estEnPleinEcran();
  sessionLecteur ??= { dejaEnPleinEcran: enPleinEcran };
  return enPleinEcran;
}

/**
 * Ferme la session, et défait le plein écran que le FILM avait posé. Windows seul.
 *
 * # Ce que ça règle, et là uniquement
 *
 * Le plein écran de Windows est une PARADE : la fenêtre reste à l'état normal, on
 * lui retire son cadre et on la pose sur tout l'écran (voir l'en-tête de
 * `fullscreen.ts`). Il survivait à la vidéo, si bien qu'on parcourait ensuite tout
 * le catalogue dans une fenêtre sans barre de titre, sans bouton de fermeture, et
 * par-dessus la barre des tâches. Elle retrouve donc EXACTEMENT le mode d'avant le
 * film — sauf si elle y était déjà, auquel cas ce plein écran-là est celui de
 * l'utilisateur et pas celui du film.
 *
 * # macOS ne défait RIEN, et c'est la règle
 *
 * ⚠️ Le contraire a été livré, et il coûtait deux défauts d'un coup.
 *
 * Là-bas le plein écran est celui du SYSTÈME, avec son espace dédié : en sortir
 * fait glisser tout l'écran vers le bureau d'origine, une seconde durant, pour un
 * geste que personne n'a demandé — on quittait un film, pas un plein écran.
 *
 * Et cette transition ne partait jamais seule. Elle s'ouvrait à l'instant précis
 * où la page navigue, donc où mpv commence à mourir — et il met jusqu'à trois
 * secondes à emporter sa fenêtre. Or celle-ci est OPAQUE ET NOIRE par
 * construction, c'est même tout son rôle (`video/macosChildWindow.ts`). Détachée
 * vivante au milieu d'un changement d'espace, elle restait seule à l'écran : un
 * rectangle noir posé par-dessus l'application, signalé comme tel. Ne plus
 * déclencher la transition ôte la course ; `MacosSurface.detach` ferme le reste.
 *
 * La règle vaut donc pour les trois états, et sans exception : fenêtrée, ZOOMÉE ou
 * en plein écran, la fenêtre reste comme l'utilisateur l'a laissée. Son état lui
 * appartient ; le film n'en est que le locataire.
 */
export function fermerSessionLecteur(win: BrowserWindow): void {
  const session = sessionLecteur;
  sessionLecteur = null;
  // Noté même quand il n'y a rien à faire : `estEnPleinEcran` interroge cette
  // fenêtre-là, et c'est la réponse que `leavePlayerFullscreenScope` rediffuse.
  noterFenetre(win);
  if (!PARADE_WINDOWS) return;
  if (session === null) return;
  // Le plein écran était le sien avant le film : il lui appartient.
  if (session.dejaEnPleinEcran) return;
  if (!estEnPleinEcran()) return;
  quitter(win);
}
