import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { PickedProfileDto, PickerProfileDto } from "@tentacle-tv/shared";
import { dropAllSessions } from "../../../auth/dropSessions";
import { usePickFlow, type PickFlow } from "../../../profiles/pick/usePickFlow";
import { commitPick, type CommitResult } from "../../../profiles/switch/commitPick";
import { pickerModelOf } from "../../../profiles/launch/pickerModel";
import type { PinPadModel } from "../../../profiles/picker/pickerTypes";
import { useWatchTogether } from "../../../watchTogether/WatchTogetherProvider";

/**
 * Octave — ouvrir un profil de la famille SANS quitter la musique : le même
 * choix que « Qui regarde ? » (`usePickFlow` : le pavé du code si le profil en
 * a un, le serveur qui seul dit juste ou faux, ses refus), la même bascule
 * (`commitPick` : jetons échangés, Watch Together quitté, cache effacé), mais
 * sans rideau ni arrivée (`arrival: false`) et la page rechargée là où l'on
 * est — la page d'Octave en cours, sauf `landing`.
 */

export interface OctavePickOptions {
  profiles: readonly PickerProfileDto[];
  /** La réponse du serveur est arrivée, la bascule faite : « stay » (son profil, sans rechargement) ou « reload ». */
  onOpened?: (result: CommitResult) => void;
  /** La liste a changé sous nos pieds (profil retiré, blocage posé) : la relire. */
  onStale?: () => void;
  /** La page à rouvrir après le rechargement ; la page en cours par défaut. */
  landing?: string;
}

export interface OctavePick {
  flow: PickFlow;
  /** Le pavé à montrer, déjà mis en forme pour `ProfilePinPad` ; null hors du pavé. */
  pad: PinPadModel | null;
}

/** La page où l'on est, telle qu'on la rouvrira (chemin et requête, jamais l'origine). */
export function currentLanding(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function useOctavePick({ profiles, onOpened, onStale, landing }: OctavePickOptions): OctavePick {
  const { t, i18n } = useTranslation("profilePicker");
  const client = useJellyfinClient();
  const queryClient = useQueryClient();
  const { isInGroup, actions } = useWatchTogether();

  const onPicked = useCallback(async (picked: PickedProfileDto) => {
    const result = await commitPick(picked, {
      landing: landing ?? currentLanding(),
      leaveGroup: isInGroup ? () => actions.leave() : undefined,
      arrival: false,
    });
    onOpened?.(result);
  }, [landing, isInGroup, actions, onOpened]);

  const onAccountLost = useCallback(() => dropAllSessions(client, queryClient), [client, queryClient]);
  const flow = usePickFlow({
    profiles,
    deviceName: client.getDeviceName(),
    onPicked,
    onStale: onStale ?? noop,
    onAccountLost,
  });

  const pad = useMemo(() => {
    const model = pickerModelOf({ listing: null, error: null, flow, openingLabel: null, language: i18n.language, t });
    return model.kind === "pin" ? model.pad : null;
  }, [flow, i18n.language, t]);

  return { flow, pad };
}

function noop(): void {}
