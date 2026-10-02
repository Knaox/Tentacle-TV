import { memo } from "react";
import { useTranslation } from "react-i18next";
import { MY_TITLE_PERCENT_KEY } from "@tentacle-tv/shared";
import { Chip } from "../../controls/Chip";
import { ArrivalSign } from "../../requests/ArrivalSign";
import type { ArrivalModel } from "../../requests/arrivalTypes";
import { useArrivalPercent } from "../../requests/useArrivalPercent";
import type { MissingSeasonTabModel } from "./detailTypes";

/**
 * Un onglet GRISÉ de la bande des saisons : une saison que la bibliothèque
 * n'a pas. Un « + » quand elle se demande, une horloge quand elle l'est déjà
 * — et, dès qu'elle fait partie d'une demande du compte, son camembert et son
 * état (« En attente », « En cours · 42 % »), qui avance seul d'une seconde à
 * l'autre (`useArrivalPercent`), comme une ligne de « Mes demandes ».
 *
 * TOUJOURS la même pastille, quel que soit l'état : seul son contenu change.
 * Remonter une autre vue sous l'onglet qu'on vient d'activer lui ferait
 * perdre le focus — il doit le garder après sa demande.
 */

interface Props {
  season: MissingSeasonTabModel;
  focusKey: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

/** Aucune demande : rien ne bouge, aucun minuteur. */
const IDLE: ArrivalModel = { state: "pending", percent: null, etaSeconds: null, at: 0, live: false };

export const MissingSeasonTab = memo(function MissingSeasonTab({ season, ...target }: Props) {
  const { t } = useTranslation();
  const request = season.request;
  const percent = useArrivalPercent(request?.arrival ?? IDLE);
  const value = request?.arrival.state === "arriving" && percent !== null ? t(MY_TITLE_PERCENT_KEY, { percent: Math.floor(percent) }) : null;
  const detail = request ? (value ? `${request.label} · ${value}` : request.label) : undefined;
  return (
    <Chip
      label={season.label}
      detail={detail}
      icon={request ? undefined : season.requestable ? "plus" : "clock"}
      leading={request ? <ArrivalSign state={request.arrival.state} percent={percent} size={26} disc={false} /> : undefined}
      absent
      accessibilityLabel={`${season.label}, ${detail ?? season.status}`}
      {...target}
    />
  );
});
