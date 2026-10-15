import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useUpdateUserRights,
  userRightsRefusalOf,
  type UserRightKey,
  type UserRightsPatch,
} from "@tentacle-tv/api-client";
import { useToast } from "../../../../contexts/ToastContext";
import { needsConfirmation, refusalKey } from "./rightsModel";

export interface RightsWriter {
  /** Écrit un correctif — après confirmation s'il engage (administration, désactivation). */
  write: (patch: UserRightsPatch) => void;
  isPending: (field: UserRightKey) => boolean;
  /** Le refus du serveur, en mots, sous le réglage qui l'a provoqué ; null sinon. */
  errorFor: (field: UserRightKey) => string | null;
  confirming: UserRightsPatch | null;
  confirm: () => void;
  cancel: () => void;
}

/**
 * L'écriture des droits d'un compte : chaque geste part aussitôt (un
 * correctif, jamais la politique entière), l'écran prend l'état RELU que
 * le serveur rend, et un refus est dit en mots sous le réglage — l'écran
 * revient alors à la vérité de Jellyfin (la mutation relit le compte).
 */
export function useRightsWriter(userId: string): RightsWriter {
  const { t } = useTranslation("userRights");
  const { show } = useToast();
  const { mutateAsync } = useUpdateUserRights();
  const [pending, setPending] = useState<ReadonlySet<UserRightKey>>(new Set());
  const [error, setError] = useState<{ fields: UserRightKey[]; text: string } | null>(null);
  const [confirming, setConfirming] = useState<UserRightsPatch | null>(null);

  const send = useCallback((patch: UserRightsPatch) => {
    const fields = Object.keys(patch) as UserRightKey[];
    setPending((current) => new Set([...current, ...fields]));
    setError((current) => (current && current.fields.some((field) => fields.includes(field)) ? null : current));
    mutateAsync({ userId, patch }).then(
      () => show("success", t("saved")),
      (reason: unknown) => {
        const text = t(refusalKey(userRightsRefusalOf(reason)));
        setError({ fields, text });
        show("error", text);
      },
    ).finally(() => {
      setPending((current) => new Set([...current].filter((field) => !fields.includes(field))));
    });
  }, [mutateAsync, userId, show, t]);

  const write = useCallback((patch: UserRightsPatch) => {
    const engaging = Object.entries(patch).some(([field, value]) => needsConfirmation(field as UserRightKey, value));
    if (engaging) setConfirming(patch);
    else send(patch);
  }, [send]);

  return useMemo(() => ({
    write,
    isPending: (field: UserRightKey) => pending.has(field),
    errorFor: (field: UserRightKey) => (error?.fields.includes(field) ? error.text : null),
    confirming,
    confirm: () => {
      if (confirming) send(confirming);
      setConfirming(null);
    },
    cancel: () => setConfirming(null),
  }), [write, pending, error, confirming, send]);
}
