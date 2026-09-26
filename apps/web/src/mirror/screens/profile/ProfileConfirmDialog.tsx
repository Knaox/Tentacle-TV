import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import type { ProfileActions } from "./useProfileActions";

/** Titre, message et bouton de chaque confirmation (les `Alert.alert` de l'app). */
const COPY = {
  changeServer: { title: "changeServerTitle", message: "changeServerMessage", confirm: "changeServerConfirm", cancel: "clearCacheCancel" },
  clearCache: { title: "clearCacheTitle", message: "clearCacheMessage", confirm: "clearCacheConfirm", cancel: "clearCacheCancel" },
  deleteAccount: { title: "deleteAccountTitle", message: "deleteAccountMessage", confirm: "deleteAccountConfirm", cancel: "deleteAccountCancel" },
} as const;

/** Les confirmations destructives du profil, sur le dialogue maison du web. */
export function ProfileConfirmDialog({ actions }: { actions: ProfileActions }) {
  const { t } = useTranslation("profile");
  const { confirm, busy, setConfirm, runConfirmed } = actions;
  const copy = confirm ? COPY[confirm] : COPY.clearCache;
  return (
    <ConfirmDialog
      open={confirm !== null}
      title={t(copy.title)}
      message={t(copy.message)}
      confirmLabel={t(copy.confirm)}
      cancelLabel={t(copy.cancel)}
      onConfirm={() => void runConfirmed()}
      onCancel={() => setConfirm(null)}
      pending={busy}
      danger
    />
  );
}
