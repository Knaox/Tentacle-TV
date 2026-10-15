import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateUserRights, userRightsRefusalOf } from "@tentacle-tv/api-client";
import type { UserRightsKey, UserRightsPatch } from "@tentacle-tv/shared";
import { useToast } from "../../../../contexts/ToastContext";
import { needsConfirmation, refusalKey } from "./rightsModel";

export interface RightsWriter {
  /** Écrit un correctif — après confirmation s'il engage (administration, désactivation). */
  write: (patch: UserRightsPatch) => void;
  isPending: (field: UserRightsKey) => boolean;
  /** Le refus du serveur, en mots, sous le réglage qui l'a provoqué ; null sinon. */
  errorFor: (field: UserRightsKey) => string | null;
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
  const [pending, setPending] = useState<ReadonlySet<UserRightsKey>>(new Set());
  const [error, setError] = useState<{ fields: UserRightsKey[]; text: string } | null>(null);
  const [confirming, setConfirming] = useState<UserRightsPatch | null>(null);

  const send = useCallback((patch: UserRightsPatch) => {
    const fields = Object.keys(patch) as UserRightsKey[];
    setPending((current) => new Set([...current, ...fields]));
    setError((current) => (current && current.fields.some((field) => fields.includes(field)) ? null : current));
    mutateAsync({ userId, patch }).then(
      () => show("success", t("saved")),
      (reason: unknown) => {
        const refusal = userRightsRefusalOf(reason);
        const text = t(refusalKey(refusal?.error ?? null, fields));
        // `invalid_value` nomme les champs refusés : l'erreur va sous eux.
        setError({ fields: refusal?.fields?.length ? refusal.fields : fields, text });
        show("error", text);
      },
    ).finally(() => {
      setPending((current) => new Set([...current].filter((field) => !fields.includes(field))));
    });
  }, [mutateAsync, userId, show, t]);

  const write = useCallback((patch: UserRightsPatch) => {
    const engaging = Object.entries(patch).some(([field, value]) => needsConfirmation(field as UserRightsKey, value));
    if (engaging) setConfirming(patch);
    else send(patch);
  }, [send]);

  return useMemo(() => ({
    write,
    isPending: (field: UserRightsKey) => pending.has(field),
    errorFor: (field: UserRightsKey) => (error?.fields.includes(field) ? error.text : null),
    confirming,
    confirm: () => {
      if (confirming) send(confirming);
      setConfirming(null);
    },
    cancel: () => setConfirming(null),
  }), [write, pending, error, confirming, send]);
}
