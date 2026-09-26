import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CreatedInviteDto } from "@tentacle-tv/shared";
import { Modal } from "../../ui/Modal";
import { ModalHeader } from "../../ui/ModalHeader";
import { useCreateInvite } from "../../../hooks/useAdminInvites";
import { DEFAULT_DRAFT, resolveDraft, type InviteDraft } from "./inviteDraft";
import { InviteForm } from "./InviteForm";
import { InviteReady } from "./InviteReady";

interface NewInviteDialogProps {
  open: boolean;
  onClose: () => void;
  /** L'origine publique des liens (`useInviteLinkBase`). */
  linkBase: string;
  /** L'invitation est créée : la page la mettra en évidence à la fermeture. */
  onCreated: (id: string) => void;
}

/**
 * « Nouvelle invitation » : les réglages, puis le lien prêt à copier ou à
 * partager, dans la même fenêtre. La page remonte ce composant à chaque
 * ouverture (clé) : le formulaire repart des réglages par défaut, et la
 * fenêtre garde son contenu pendant son animation de fermeture.
 */
export function NewInviteDialog({ open, onClose, linkBase, onCreated }: NewInviteDialogProps) {
  const { t } = useTranslation("adminInvites");
  const titleId = useId();
  const create = useCreateInvite();
  const [draft, setDraft] = useState<InviteDraft>(DEFAULT_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState<CreatedInviteDto | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const result = resolveDraft(draft);
    if (!result.ok || create.isPending) return;
    create.mutate(result.request, {
      onSuccess: (invite) => {
        setCreated(invite);
        onCreated(invite.id);
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={500} labelledBy={titleId} dismissOnBackdrop={!create.isPending}>
      {created ? (
        <InviteReady invite={created} linkBase={linkBase} titleId={titleId} onDone={onClose} />
      ) : (
        <>
          <ModalHeader title={t("dialogTitle")} subtitle={t("dialogSubtitle")} onClose={onClose} titleId={titleId} />
          <InviteForm
            draft={draft}
            onChange={setDraft}
            submitted={submitted}
            pending={create.isPending}
            failed={create.isError}
            onSubmit={submit}
            onCancel={onClose}
          />
        </>
      )}
    </Modal>
  );
}
