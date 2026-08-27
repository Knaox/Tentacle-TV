/**
 * Le garde-fou du choix de session : un réglage ne doit JAMAIS briquer l'app.
 *
 * # Le piège, vécu le 27.08.2026
 *
 * L'utilisateur choisit `x11` dans les Préférences ; or sur son poste XWayland
 * ne sait pas afficher (Mesa `dri_gbm.so` refusé — SELinux). Le processus GPU
 * de Chromium meurt en boucle, la fenêtre ne se montre jamais… et le réglage
 * fautif est PERSISTANT : chaque relance rejoue l'échec. Sans fenêtre, pas de
 * Préférences — l'application est briquée. Le choix `wayland` imposé porte le
 * même risque (un compositeur qui refuse, et plus aucun repli — voir
 * `sessionGraphique.ts`). Seul `auto` est sans danger : Electron y garde son
 * propre repli.
 *
 * # Les deux filets, indépendants
 *
 * 1. **La surveillance du processus GPU** (`surveillerGpu`) : trois morts
 *    violentes pendant qu'un choix explicite est en vigueur → le choix est
 *    réécrit en `auto` et l'application se RELANCE d'elle-même. L'utilisateur
 *    voit un clignotement, puis une fenêtre — pas un écran vide.
 * 2. **Le témoin d'affichage** : posé quand un choix explicite s'applique,
 *    effacé à la PREUVE d'affichage (`ready-to-show`). S'il est encore là au
 *    lancement suivant, c'est que le dernier essai de ce choix n'a jamais
 *    montré de fenêtre — quel que soit le mode d'échec — et le choix revient à
 *    `auto`. Faux positif possible (app tuée avant sa première image) : le
 *    coût est un réglage remis à `auto`, le gain est de ne jamais rester noir.
 *
 * `TENTACLE_LINUX_SESSION` court-circuite tout : c'est l'outil d'essai des
 * développeurs, il ne touche pas au réglage et ne doit pas être « secouru ».
 */

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FICHIER_SESSION, type ChoixSession } from "./sessionGraphique";

/** Le témoin : « un choix explicite est à l'essai, l'affichage n'a pas encore eu lieu ». */
export const FICHIER_TEMOIN = "session-essai.json";

/** Nombre de morts du processus GPU avant de conclure que ce montage n'affichera pas. */
const MORTS_GPU_FATALES = 3;

let dossierTemoin: string | null = null;

/** Le choix consigné dans le témoin, ou `null` (absent, illisible, farfelu). */
export function lireTemoin(dossier: string): ChoixSession | null {
  try {
    const brut: unknown = JSON.parse(readFileSync(path.join(dossier, FICHIER_TEMOIN), "utf8"));
    const v = typeof brut === "object" && brut !== null ? (brut as { choix?: unknown }).choix : null;
    return v === "wayland" || v === "x11" ? v : null;
  } catch {
    return null;
  }
}

/** Pose le témoin — et retient le dossier pour `sessionAffichee()`. */
export function poserTemoin(dossier: string, choix: ChoixSession): void {
  dossierTemoin = dossier;
  try {
    writeFileSync(
      path.join(dossier, FICHIER_TEMOIN),
      `${JSON.stringify({ choix, depuis: new Date().toISOString() }, null, 2)}\n`,
      "utf8",
    );
  } catch {
    // Un témoin qui ne s'écrit pas prive du filet n° 2, pas du lancement.
  }
}

export function effacerTemoin(dossier: string): void {
  try {
    rmSync(path.join(dossier, FICHIER_TEMOIN), { force: true });
  } catch {
    // Rien à effacer, ou rien à pouvoir faire — dans les deux cas on continue.
  }
}

/**
 * La fenêtre principale vient de PROUVER qu'elle s'affiche : l'essai du choix
 * explicite est concluant. Sans effet si aucun témoin n'est posé (choix auto,
 * autre plateforme).
 */
export function sessionAffichee(): void {
  if (dossierTemoin !== null) effacerTemoin(dossierTemoin);
}

/**
 * À appeler AVANT de lire le choix : si le témoin du lancement précédent est
 * encore là pour le MÊME choix, ce choix n'a jamais affiché — on le réécrit en
 * `auto`. Rend le choix condamné, ou `null` si rien n'était à redresser.
 * Un témoin d'un AUTRE choix (l'utilisateur a changé entre-temps) est
 * simplement effacé : le nouveau choix a droit à son propre essai.
 */
export function redresserChoixCondamne(dossier: string, choixDemande: ChoixSession): ChoixSession | null {
  const temoin = lireTemoin(dossier);
  if (temoin === null) return null;
  effacerTemoin(dossier);
  if (temoin !== choixDemande || choixDemande === "auto") return null;
  writeFileSync(
    path.join(dossier, FICHIER_SESSION),
    `${JSON.stringify({ session: "auto" }, null, 2)}\n`,
    "utf8",
  );
  return temoin;
}

/** Le strict nécessaire d'`app` — et ce qu'un test sait imiter. */
export interface AppSurveillable {
  on(evenement: "child-process-gone", ecouteur: (e: unknown, details: { type: string; reason: string }) => void): unknown;
  relaunch(): void;
  exit(code?: number): void;
}

/**
 * Filet n° 1 : trois morts violentes du processus GPU sous un choix explicite,
 * et l'application réécrit `auto` puis SE RELANCE. Après la relance le choix
 * n'est plus explicite : la surveillance ne peut pas boucler.
 */
export function surveillerGpu(dossier: string, application: AppSurveillable): void {
  let morts = 0;
  let secouru = false;
  application.on("child-process-gone", (_e, details) => {
    if (secouru || details.type !== "GPU") return;
    if (details.reason !== "crashed" && details.reason !== "abnormal-exit" && details.reason !== "launch-failed") return;
    morts += 1;
    if (morts < MORTS_GPU_FATALES) return;
    secouru = true;
    console.error(
      `[session] ⚠️ ${morts} morts du processus GPU : ce montage n'affichera pas — retour en auto et relance`,
    );
    writeFileSync(
      path.join(dossier, FICHIER_SESSION),
      `${JSON.stringify({ session: "auto" }, null, 2)}\n`,
      "utf8",
    );
    effacerTemoin(dossier);
    application.relaunch();
    application.exit(0);
  });
}
