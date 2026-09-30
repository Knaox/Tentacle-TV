import { useCallback, useEffect, useRef, useState } from "react";
import {
  useDevicePairGenerate,
  useDevicePairStatus,
  useRelayGenerate,
  useRelayStatus,
} from "@tentacle-tv/api-client";
import type { RelayStatusResponse } from "@tentacle-tv/api-client";
import { TV_PLATFORM_LABEL } from "../lib/platformLabel";

/** La durée de vie d'un code affiché, relais comme serveur : 5 min. */
export const PAIRING_CODE_TTL = 300;

/**
 * Un code de jumelage affiché par la TV, tel que l'écran le montre : le code,
 * le temps qui reste, et les deux états sans code (génération en cours,
 * génération en échec). `regenerate` en demande un nouveau (Réessayer,
 * Générer un nouveau code).
 */
export interface PairingCode {
  code: string | null;
  /** Secondes avant expiration. */
  remaining: number;
  expired: boolean;
  /** Première génération en cours : aucun code encore. */
  loading: boolean;
  /** La génération a échoué : aucun code. */
  failed: boolean;
  regenerate: () => void;
}

/** Le compte confirmé depuis le téléphone ou le web. */
export interface PairedAccount {
  token: string;
  user: { id: string; name: string };
}

type RequestCode = (onCode: (code: string) => void) => void;

/**
 * Le cycle commun aux deux codes : génération à l'activation, compte à
 * rebours, remise à zéro à la désactivation. `active` permet de tenir le hook
 * dans un écran qui ne montre pas toujours le code (l'automate du jumelage) :
 * inactif, rien n'est demandé ni sondé.
 */
function useCodeLifecycle(active: boolean, request: RequestCode, pending: boolean, failed: boolean): PairingCode {
  const [code, setCode] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(PAIRING_CODE_TTL);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  // Une réponse arrivée après la désactivation (ou pour une demande
  // remplacée) ne doit pas réafficher un code.
  const generation = useRef(0);

  const reset = useCallback(() => {
    generation.current += 1;
    setCode(null);
    setRemaining(PAIRING_CODE_TTL);
    setGeneratedAt(null);
  }, []);

  const regenerate = useCallback(() => {
    reset();
    const current = generation.current;
    request((next) => {
      if (generation.current !== current) return;
      setCode(next);
      setGeneratedAt(Date.now());
    });
  }, [request, reset]);

  useEffect(() => {
    if (active) regenerate();
    else reset();
    // À l'activation seulement : `regenerate` change d'identité avec la requête.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!generatedAt) return;
    const interval = setInterval(() => {
      const left = Math.max(0, PAIRING_CODE_TTL - Math.floor((Date.now() - generatedAt) / 1000));
      setRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [generatedAt]);

  return {
    code,
    remaining,
    expired: remaining <= 0,
    loading: !code && pending,
    failed: !code && failed,
    regenerate,
  };
}

/** Le code du RELAIS (flux principal) : confirmé, il livre serveur, jeton et compte. */
export function useRelayPairingCode(
  active: boolean,
  onConfirmed: (data: RelayStatusResponse) => void,
): PairingCode {
  const { mutate, isPending, isError } = useRelayGenerate();
  const request = useCallback<RequestCode>(
    (onCode) => mutate(undefined, { onSuccess: (data) => onCode(data.code) }),
    [mutate],
  );
  const state = useCodeLifecycle(active, request, isPending, isError);
  const { data } = useRelayStatus(active && state.code && !state.expired ? state.code : null);
  useEffect(() => {
    if (data?.status === "confirmed") onConfirmed(data);
  }, [data, onConfirmed]);
  return state;
}

/**
 * Le code du SERVEUR saisi à la main : la TV l'affiche, l'utilisateur le
 * confirme depuis son téléphone ou le web (Réglages → Jumeler la TV).
 */
export function useServerPairingCode(
  active: boolean,
  onConfirmed: (account: PairedAccount) => void,
): PairingCode {
  const { mutate, isPending, isError } = useDevicePairGenerate();
  const request = useCallback<RequestCode>(
    (onCode) => mutate({ deviceName: TV_PLATFORM_LABEL }, { onSuccess: (data) => onCode(data.code) }),
    [mutate],
  );
  const state = useCodeLifecycle(active, request, isPending, isError);
  const { data } = useDevicePairStatus(active && state.code && !state.expired ? state.code : null);
  useEffect(() => {
    if (data?.status === "confirmed" && data.token && data.user?.id && data.user?.name) {
      onConfirmed({ token: data.token, user: { id: data.user.id, name: data.user.name } });
    }
  }, [data, onConfirmed]);
  return state;
}
