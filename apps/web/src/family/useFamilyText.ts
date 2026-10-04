import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { familyErrorFromApi } from "@tentacle-tv/api-client";
import { familyErrorKey, type FamilyErrorCode } from "@tentacle-tv/shared";

/**
 * Les mots de la Famille qui dépendent de la langue : un refus du serveur
 * (son CODE, traduit dans l'espace `family`, et la date du prochain essai
 * quand il la donne) et les dates des invitations.
 */
export function useFamilyText() {
  const { t, i18n } = useTranslation(["familyWeb", "family"]);

  const formatDate = useCallback(
    (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "long" }),
    [i18n.language],
  );

  const formatDateTime = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleString(i18n.language, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
    [i18n.language],
  );

  const codeText = useCallback((code: FamilyErrorCode) => t(familyErrorKey(code)), [t]);

  /** Le refus porté par une erreur d'appel ; une phrase générique pour un
   *  échec réseau ou un serveur muet. */
  const errorText = useCallback(
    (error: unknown) => {
      const refusal = familyErrorFromApi(error);
      if (!refusal) return t("familyWeb:errors.generic");
      const when = refusal.retryAt ?? refusal.lockedUntil;
      const base = codeText(refusal.code);
      // Un code PIN faux dit les essais qui restent avant le blocage.
      if (refusal.attemptsLeft !== undefined) return `${base} ${t("family:pin.attemptsLeft", { count: refusal.attemptsLeft })}`;
      return when ? `${base} ${t("familyWeb:errors.retryAt", { date: formatDateTime(when) })}` : base;
    },
    [t, codeText, formatDateTime],
  );

  return { formatDate, codeText, errorText };
}
