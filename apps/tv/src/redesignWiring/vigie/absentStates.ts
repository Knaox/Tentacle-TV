import type { TFunction } from "i18next";
import {
  MY_TITLE_PERCENT_KEY,
  MY_TITLE_STATE_KEYS,
  type MyTitle,
  type TitleState,
} from "@tentacle-tv/shared";
import type { AbsentModel, AbsentTone } from "../../redesign/cards/cardTypes";
import { ARRIVED_LABEL_KEY, STILL_READING, arrivalOf, arrivedModel, type ArrivalReading } from "./arrivalModels";

/**
 * Ce que dit le badge d'un titre absent quand le serveur sait demander des
 * titres (garde Vigie ouverte) — pur. D'abord SA demande, si le compte en a
 * fait une (`mine` : « En attente », « En cours »…, les mots de Tentacle) —
 * son affiche ARRIVE alors façon Apple (`arrival` : grise, elle se colore au
 * prorata de l'avancement, le camembert au centre, le pour cent qui avance) ;
 * puis, sortie de la liste en avançant, « Disponible » en pleine couleur ;
 * sinon ce que l'extension dit du titre (`state` : « Demandé » par quelqu'un
 * d'autre, « En partie »…) ; sinon « Pas dans la bibliothèque ».
 *
 * Et les phrases des avis : jamais un mot qui nommerait l'extension, son
 * service, ou la famille de « téléchargement » — une phrase de l'extension
 * qui en porte un cède à la nôtre.
 */

const MINE_TONE: Record<MyTitle["state"], AbsentTone> = {
  pending: "pending",
  arriving: "active",
  importing: "ready",
  blocked: "blocked",
};

const BADGE_TONE: Record<NonNullable<TitleState["badge"]>["tone"], AbsentTone> = {
  neutral: "neutral",
  info: "pending",
  success: "ready",
  warning: "blocked",
};

/** « En cours · 42 % » : l'état d'une demande du compte, dans les mots de Tentacle. */
export function mineLabel(t: TFunction, mine: MyTitle): string {
  const state = t(MY_TITLE_STATE_KEYS[mine.state]);
  return mine.percent !== null ? `${state} · ${t(MY_TITLE_PERCENT_KEY, { percent: Math.round(mine.percent) })}` : state;
}

/** Sa demande : le MOT de son état (la carte y ajoute le pour cent à l'instant), et son arrivée. */
export function absentFromMine(t: TFunction, mine: MyTitle, reading: ArrivalReading = STILL_READING): AbsentModel {
  return {
    label: t(MY_TITLE_STATE_KEYS[mine.state]),
    tone: MINE_TONE[mine.state],
    ...(mine.percent !== null ? { progress: mine.percent / 100 } : {}),
    arrival: arrivalOf(mine, reading),
  };
}

/** Sa demande vient d'aboutir : « Disponible », en pleine couleur, le camembert qui s'efface. */
export function absentArrived(t: TFunction, reading: ArrivalReading = STILL_READING): AbsentModel {
  return { label: t(ARRIVED_LABEL_KEY), tone: "ready", arrival: arrivedModel(reading) };
}

/** Le badge d'un titre absent : sa demande, son arrivée, l'état que dit l'extension, ou rien de plus que l'absence. */
export function absentOf(
  t: TFunction,
  mine: MyTitle | undefined,
  state: TitleState | null | undefined,
  reading: ArrivalReading = STILL_READING,
  arrived = false,
): AbsentModel {
  if (mine) return absentFromMine(t, mine, reading);
  if (arrived) return absentArrived(t, reading);
  if (state?.badge) return { label: state.badge.label, tone: BADGE_TONE[state.badge.tone] };
  return { label: t("cards:notInLibrary"), tone: "neutral" };
}

/* Ce qu'un avis ne dit jamais : le nom de l'extension ou de son service, ni « téléchargement ». */
const UNSAID = /vigie|plugin|extension|jellyseerr|overseerr|t[ée]l[ée]charg|download/i;

/** La phrase de l'extension, si elle se dit telle quelle ; sinon `null` (l'appelant dit la sienne). */
export function sayable(message: string | null | undefined): string | null {
  return message && !UNSAID.test(message) ? message : null;
}
