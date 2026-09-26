import { useTranslation } from "react-i18next";
import { StatusPill } from "../kit";
import type { AdminUser } from "./userListModel";

/**
 * Le rôle et l'état d'un compte, en pastilles : administrateur, désactivé,
 * et « Vous » pour le compte connecté. Rien pour un compte ordinaire actif —
 * c'est le cas courant, il n'a pas à se signaler.
 */
export function UserBadges({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const { t } = useTranslation("admin");
  return (
    <>
      {user.isAdministrator && <StatusPill tone="brand" size="sm">{t("userAdmin")}</StatusPill>}
      {user.isDisabled && <StatusPill tone="error" size="sm">{t("userDisabled")}</StatusPill>}
      {isSelf && <StatusPill tone="neutral" size="sm" dot={false}>{t("userYou")}</StatusPill>}
    </>
  );
}
