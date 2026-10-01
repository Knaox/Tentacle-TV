import type { IconName } from "../../icons/Icon";

/**
 * Le contrat du message-outil du lecteur — ce qui se dit quand un serveur ne
 * répond plus. Deux formes, une seule à la fois :
 * - `notice` : un bandeau DISCRET, jamais focalisable — la lecture continue
 *   (« encore 34 s chargées »), ou elle vient de reprendre ;
 * - `panel` : la lecture est arrêtée — ce qui se passe, ce qui va se passer
 *   (« elle reprendra toute seule à 20:32 »), où en est la vérification, et
 *   les gestes : réessayer, baisser la qualité ; la croix Retour, une fois
 *   le panneau activé, referme le lecteur.
 * Les textes arrivent traduits ; la vue ne décide de rien.
 */

export type TroubleTone = "warning" | "success";

/** Les pilules du panneau. */
export type TroublePillKey = "retry" | "quality";

/** Ses gestes : les pilules, et la croix (`back`). */
export type TroubleActionKey = TroublePillKey | "back";

export interface TroubleAction {
  key: TroublePillKey;
  label: string;
  icon: IconName;
}

export interface TroubleNoticeModel {
  mode: "notice";
  icon: IconName;
  tone: TroubleTone;
  title: string;
  detail?: string;
}

export interface TroublePanelModel {
  mode: "panel";
  icon: IconName;
  title: string;
  /** Ce qui va se passer — « Elle reprendra toute seule à 20:32, dès son retour. » */
  detail: string;
  /** Où en est la vérification — « Nouvelle vérification dans 4 s ». */
  status: string;
  /** Une vérification ou une reprise est en cours. */
  busy: boolean;
  /** Le premier est le geste principal. */
  actions: TroubleAction[];
  /** Le panneau a été ACTIVÉ par un geste de l'utilisateur : ses boutons
   *  tiennent le focus, l'habillage recule et la croix Retour paraît. Avant,
   *  il se montre seulement. */
  active: boolean;
}

export type PlaybackTroubleModel = TroubleNoticeModel | TroublePanelModel;
