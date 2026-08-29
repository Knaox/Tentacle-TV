/**
 * Garde de sortie : on ne quitte pas sur un téléchargement en cours sans le
 * demander.
 *
 * # Pourquoi l'évènement `close` de la fenêtre, et pas `before-quit`
 *
 * C'est le SEUL point de passage commun à la croix, à Alt+F4 et à `app.quit()`
 * — `window-all-closed` (`index.ts:159`) n'arrive qu'APRÈS, quand il est trop
 * tard pour retenir quoi que ce soit. Reste `app.exit(0)`, utilisé par
 * `tentacle:relaunch` pour le redémarrage d'une mise à jour : il court-circuite
 * tout, et c'est très bien ainsi — l'utilisateur vient d'accepter le
 * redémarrage, lui reposer la question serait absurde.
 *
 * # Ne JAMAIS piéger l'utilisateur
 *
 * `preventDefault()` sur une fermeture est un pouvoir désagréable : mal tenu, il
 * donne une fenêtre qui refuse de se fermer, et il ne reste au malheureux que le
 * gestionnaire des tâches. Trois garde-fous, et le test porte sur eux :
 * le loquet `confirmed` (une fois l'accord donné, on ne redemande plus), le
 * verrou `pending` (deux Alt+F4 n'empilent pas deux boîtes), et le repli sur
 * la fermeture si la boîte échoue.
 *
 * La boîte est NATIVE et construite ici, dans le processus principal : elle
 * s'affiche même si la page est occupée par une lecture, et aucun canal
 * supplémentaire n'est ouvert au rendu. Une confirmation demandée à la page
 * aurait exigé un aller-retour IPC pendant la fermeture — donc un délai de
 * garde, donc un rendu figé qui bloque la fenêtre.
 */

import { app, dialog, type BrowserWindow } from "electron";

/** Ce qu'on demande à la fenêtre, et rien de plus — pour que ça se teste. */
export interface ClosableWindow {
  on(event: "close", listener: (event: { preventDefault: () => void }) => void): unknown;
  close(): void;
  isDestroyed(): boolean;
}

/** Renvoie vrai si l'utilisateur veut quitter malgré tout. */
export type ExitRequest = (inProgress: number) => Promise<boolean>;

export function installQuitGuard(
  window: ClosableWindow,
  inProgress: () => number,
  ask: ExitRequest,
): void {
  let confirmed = false;
  let pending = false;

  window.on("close", (event) => {
    // Le `close()` qui suit l'accord repasse ici : sans ce loquet, la fenêtre
    // ne se fermerait jamais.
    if (confirmed) return;

    let left = 0;
    try {
      left = inProgress();
    } catch {
      // Un comptage qui échoue ne doit pas retenir la fermeture.
      return;
    }
    if (left <= 0) return;

    event.preventDefault();
    // Deuxième Alt+F4 pendant que la boîte est ouverte : la fermeture est
    // retenue, mais on n'ouvre pas une seconde boîte par-dessus la première.
    if (pending) return;
    pending = true;

    void ask(left)
      // La boîte n'a pas pu s'afficher : on quitte. Rester ouvert serait
      // enfermer l'utilisateur dans une fenêtre, pour protéger un transfert
      // qui reprendra de toute façon.
      .catch(() => true)
      .then((quitApp) => {
        pending = false;
        if (!quitApp) return;
        confirmed = true;
        if (!window.isDestroyed()) window.close();
      });
  });
}

/**
 * La boîte réelle, en français ou en anglais.
 *
 * La langue vient de `app.getLocale()` — celle de Windows. Le processus
 * principal ne connaît pas celle de l'application : elle vit dans le
 * `localStorage` du rendu (`apps/web/src/main.tsx:60`), et aller la chercher
 * imposerait un aller-retour IPC au pire moment. C'est de toute façon la même
 * dans l'écrasante majorité des cas, l'application détectant sa langue de
 * départ depuis celle du système.
 */
export function askNative(window: BrowserWindow): ExitRequest {
  return async (inProgress) => {
    const t = texts(inProgress);
    const { response } = await dialog.showMessageBox(window, {
      type: "warning",
      title: t.title,
      message: t.message,
      detail: t.detail,
      buttons: [t.quitApp, t.cancelLabel],
      // Annuler par défaut : Entrée ou Échap sur un réflexe ne doit pas
      // interrompre un transfert.
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    return response === 0;
  };
}

interface Texts {
  title: string;
  message: string;
  detail: string;
  quitApp: string;
  cancelLabel: string;
}

function texts(inProgress: number): Texts {
  if (app.getLocale().toLowerCase().startsWith("fr")) {
    return {
      title: "Téléchargement en cours",
      message:
        inProgress === 1
          ? "Un téléchargement est en cours."
          : `${String(inProgress)} téléchargements sont en cours.`,
      detail:
        "Quitter maintenant les interrompt. Ils reprendront là où ils en sont" +
        " au prochain lancement de Tentacle.",
      quitApp: "Quitter quand même",
      cancelLabel: "Annuler",
    };
  }
  return {
    title: "Download in progress",
    message:
      inProgress === 1 ? "A download is in progress." : `${String(inProgress)} downloads are in progress.`,
    detail:
      "Quitting now interrupts them. They will pick up where they left off" +
      " the next time Tentacle starts.",
    quitApp: "Quit anyway",
    cancelLabel: "Cancel",
  };
}
