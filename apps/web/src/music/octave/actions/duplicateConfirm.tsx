/**
 * Octave — la boîte « Déjà dans la playlist — l'ajouter quand même ? » du web. La demande vit dans api-client
 * (`askDuplicate`, la même pour le mobile) ; ici, son dialogue.
 */

import { useTranslation } from "react-i18next";
import { answerDuplicate, useDuplicateAsk } from "@tentacle-tv/api-client";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

export { askDuplicate, answerDuplicate } from "@tentacle-tv/api-client";

export function DuplicateConfirmHost() {
  const { t } = useTranslation("music");
  const ask = useDuplicateAsk();
  return (
    <ConfirmDialog
      open={ask !== null}
      title={t("playlist.duplicateTitle")}
      message={ask ? t("playlist.duplicateMessage", { title: ask.title, name: ask.playlist }) : ""}
      confirmLabel={t("playlist.duplicateConfirm")}
      cancelLabel={t("playlist.duplicateCancel")}
      onConfirm={() => answerDuplicate(true)}
      onCancel={() => answerDuplicate(false)}
    />
  );
}
