import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { DoorOpen, Tv, Users } from "lucide-react";
import { useAcceptFamilyInvitation, useDeclineFamilyInvitation } from "@tentacle-tv/api-client";
import type { IncomingInvitationDto } from "@tentacle-tv/shared";
import { Modal } from "../components/ui/Modal";
import { UserAvatar } from "../components/ui/UserAvatar";
import { useToast } from "../contexts/ToastContext";
import { useFamilyText } from "./useFamilyText";

interface FamilyInvitationPosterProps {
  invitation: IncomingInvitationDto;
  /** « Plus tard », ou l'affiche fermée sans réponse. */
  onLater: (id: string) => void;
  /** Répondue (acceptée ou refusée) : l'affiche se retire. */
  onDone: (id: string) => void;
}

/**
 * L'AFFICHE : « X vous invite à rejoindre sa famille », ce que cela implique
 * (son profil s'ouvrira sur les TV de X sans mot de passe, sauf code PIN ; on
 * peut quitter à tout moment), puis Accepter / Refuser / Plus tard.
 *
 * Les noms sont du TEXTE rendu par React — jamais interprétés comme du HTML
 * (i18next n'échappe rien, `escapeValue: false` : c'est React qui le fait).
 * L'identifiant de l'invitation voyage dans le corps des requêtes, jamais
 * dans une URL (api-client › `familyApi.ts`).
 */
export function FamilyInvitationPoster({ invitation, onLater, onDone }: FamilyInvitationPosterProps) {
  const { t } = useTranslation(["family", "familyWeb"]);
  const { formatDate, errorText } = useFamilyText();
  const toast = useToast();
  const accept = useAcceptFamilyInvitation();
  const decline = useDeclineFamilyInvitation();
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descId = useId();
  const pending = accept.isPending || decline.isPending;
  const owner = invitation.ownerName;

  const onAccept = () => {
    setError(null);
    accept.mutate(invitation.id, {
      onSuccess: () => {
        toast.show("success", t("familyWeb:poster.accepted", { owner }));
        onDone(invitation.id);
      },
      onError: (failure) => setError(errorText(failure)),
    });
  };

  const onDecline = () => {
    setError(null);
    decline.mutate(invitation.id, {
      onSuccess: () => {
        toast.show("info", t("familyWeb:poster.declined"));
        onDone(invitation.id);
      },
      onError: (failure) => setError(errorText(failure)),
    });
  };

  // Fermer (Échap, clic à côté) vaut « Plus tard » — sauf pendant un envoi.
  const close = () => {
    if (!pending) onLater(invitation.id);
  };

  return (
    <Modal open onClose={close} maxWidth={440} labelledBy={titleId} describedBy={descId} dismissOnBackdrop={!pending}>
      <div className="relative overflow-hidden p-6 sm:p-7">
        {/* Halo de marque : un dégradé posé une fois, sans animation ni flou. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-60"
          style={{ background: "radial-gradient(120% 100% at 50% 0%, rgba(var(--brand-rgb), 0.28), transparent 70%)" }}
        />
        <div className="relative flex flex-col items-center text-center">
          <div className="relative">
            <UserAvatar userId={invitation.ownerUserId} name={owner} hasAvatar size={64} />
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--surface-modal)] text-cta-brand-fg"
              style={{ backgroundImage: "var(--cta-brand-gradient)" }}
            >
              <Users size={14} />
            </span>
          </div>
          <h2 id={titleId} className="mt-4 text-lg font-bold tracking-tight text-content-primary">
            {t("family:poster.title", { owner })}
          </h2>
          <p className="mt-1 text-xs text-content-tertiary">
            {t("familyWeb:poster.expires", { date: formatDate(invitation.expiresAt) })}
          </p>
        </div>

        <ul id={descId} className="relative mt-5 space-y-3 rounded-xl border border-line-subtle bg-fill-subtle p-4 text-left">
          <li className="flex gap-3 text-sm leading-relaxed text-content-secondary">
            <Tv size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-[var(--brand-light)]" />
            <span>{t("family:poster.profile", { owner })}</span>
          </li>
          <li className="flex gap-3 text-sm leading-relaxed text-content-secondary">
            <DoorOpen size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-[var(--brand-light)]" />
            <span>{t("family:poster.leave")}</span>
          </li>
        </ul>

        {error && (
          <p role="alert" className="relative mt-4 rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-fg">
            {error}
          </p>
        )}

        <div className="relative mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={pending}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg px-5 text-sm font-bold text-cta-brand-fg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
            style={{ backgroundImage: "var(--cta-brand-gradient)" }}
          >
            {t("family:poster.accept")}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onDecline}
              disabled={pending}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-line-subtle bg-fill-soft px-4 text-sm font-semibold text-content-primary transition-colors hover:bg-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
            >
              {t("family:poster.decline")}
            </button>
            <button
              type="button"
              onClick={() => onLater(invitation.id)}
              disabled={pending}
              className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-content-secondary transition-colors hover:bg-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
            >
              {t("family:poster.later")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
