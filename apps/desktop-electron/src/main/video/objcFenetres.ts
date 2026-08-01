/**
 * Ce que le runtime Objective-C sait dire des FENÊTRES de l'application.
 *
 * Séparé de `objc.ts` — qui ne porte que le pont brut vers le runtime — pour
 * tenir la limite de 300 lignes par fichier, et parce que chercher une fenêtre
 * est un métier différent d'envoyer un message.
 *
 * ⚠️ **macOS uniquement** : remonte à `objc.ts`, qui charge le runtime à
 * l'import.
 */

import koffi from "koffi";
import { cls, msg } from "./objc";

/** Les fenêtres de l'application, avec leur nom de classe. */
export function listerFenetres(): Array<[unknown, string]> {
  const nsApp = cls("NSApplication");
  if (!nsApp) return [];
  const application = msg.get(nsApp, "sharedApplication");
  const fenetres = msg.get(application, "windows");
  const n = msg.count(fenetres, "count");
  const sortie: Array<[unknown, string]> = [];
  for (let i = 0; i < n; i += 1) {
    const f = msg.index(fenetres, "objectAtIndex:", i);
    sortie.push([f, nomDeClasse(f)]);
  }
  return sortie;
}

/**
 * Les fenêtres de l'application, en une ligne de journal.
 *
 * Tranche une question qu'aucune propriété mpv ne résout : mpv a-t-il créé une
 * fenêtre dans NOTRE processus, ou pas du tout ? Les deux cas se corrigent de
 * façons opposées, et rien ne les distingue après coup.
 */
export function fenetresApp(): string {
  const noms = listerFenetres().map(([, nom]) => nom);
  return `${noms.length} fenetre(s) : ${noms.join(", ")}`;
}

/**
 * La première fenêtre de l'application dont la classe porte `motif`.
 *
 * # Pourquoi on ne demande PAS à mpv
 *
 * mpv expose sa fenêtre dans la propriété `window-id`, et c'est la voie
 * naturelle. Elle est pourtant piégée : lire cette propriété interroge la sortie
 * vidéo, qui doit toucher sa `NSWindow` — donc passer par le thread principal.
 * Appelée DEPUIS ce même thread, la lecture attend un thread qui l'attend :
 * blocage parfait, sans un pourcent de processeur, sans message d'erreur, et
 * l'application paraît simplement inerte. Constaté deux fois en phase 1.
 *
 * AppKit, lui, répond sans rien demander à mpv.
 */
export function trouverFenetre(motif: string): unknown {
  for (const [fenetre, nom] of listerFenetres()) {
    if (nom.includes(motif)) return fenetre;
  }
  return null;
}

/**
 * Numéro de fenêtre — l'identité stable d'une NSWindow.
 *
 * Deux pointeurs rendus par koffi pour la même fenêtre ne sont pas forcément le
 * même objet JavaScript : les comparer avec `===` ne prouve rien. `windowNumber`
 * est un entier attribué par le serveur de fenêtres, unique et comparable.
 */
export function numeroFenetre(fenetre: unknown): number {
  return msg.count(fenetre, "windowNumber");
}

/**
 * Les numéros des fenêtres dont la classe porte `motif`.
 *
 * ⚠️ Sert à distinguer une fenêtre NEUVE d'un vestige. Le cœur de mpv se
 * termine sur ses propres threads, APRÈS que la commande d'arrêt a rendu la
 * main : sa NSWindow survit donc quelques instants à la lecture. Au changement
 * d'épisode — le chemin le plus sollicité, le lecteur étant remonté à chaque
 * fois — une recherche naïve retrouve alors la fenêtre MORTE et lui cale la
 * vidéo dessus. Constaté au banc : trois `swift.Window` à la seconde lecture.
 */
export function numerosFenetres(motif: string): Set<number> {
  const vus = new Set<number>();
  for (const [fenetre, nom] of listerFenetres()) {
    if (nom.includes(motif)) vus.add(numeroFenetre(fenetre));
  }
  return vus;
}

/** La première fenêtre portant `motif` dont le numéro n'est PAS dans `exclus`. */
export function trouverFenetreNeuve(motif: string, exclus: ReadonlySet<number>): unknown {
  for (const [fenetre, nom] of listerFenetres()) {
    if (nom.includes(motif) && !exclus.has(numeroFenetre(fenetre))) return fenetre;
  }
  return null;
}

/**
 * La fenêtre `a` est-elle DEVANT la fenêtre `b` à l'écran ?
 *
 * ⚠️ `[NSApp windows]` ne dit rien de l'empilement : c'est un inventaire, pas un
 * ordre. `orderedWindows` rend les fenêtres de l'AVANT vers l'ARRIÈRE, et c'est
 * la seule façon, depuis le processus, de constater qu'une fenêtre fille est
 * passée devant son parent — ce que macOS fait en entrant dans un espace de
 * plein écran, sans que la relation de filiation en paraisse altérée.
 *
 * Rend `false` si l'une des deux ne figure pas dans la liste : on ne répare que
 * ce qu'on a constaté.
 */
export function estDevant(a: unknown, b: unknown): boolean {
  const application = msg.get(cls("NSApplication"), "sharedApplication");
  const ordonnees = msg.get(application, "orderedWindows");
  const n = msg.count(ordonnees, "count");
  const na = numeroFenetre(a);
  const nb = numeroFenetre(b);
  let rangA = -1;
  let rangB = -1;
  for (let i = 0; i < n; i += 1) {
    const numero = numeroFenetre(msg.index(ordonnees, "objectAtIndex:", i));
    if (numero === na && rangA < 0) rangA = i;
    if (numero === nb && rangB < 0) rangB = i;
  }
  return rangA >= 0 && rangB >= 0 && rangA < rangB;
}

/** Nom de classe d'un objet, pour le diagnostic. */
export function nomDeClasse(objet: unknown): string {
  if (!objet) return "(null)";
  const nsstring = msg.get(objet, "className");
  if (!nsstring) return "(inconnu)";
  const utf8 = msg.get(nsstring, "UTF8String");
  if (!utf8) return "(inconnu)";
  return koffi.decode(utf8, "char", -1) as string;
}
