import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LockKeyIcon as LockKeyhole } from "@phosphor-icons/react/dist/csr/LockKey";
import { ShieldCheckIcon as ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Modal } from "../../components/ui/Modal";
import { OwnPinDialog } from "../page/PinEditors";

/**
 * `joined` : juste après avoir accepté une invitation (« Bienvenue dans la
 * famille de … ») ; `startup` : la fenêtre « Action recommandée » du
 * démarrage.
 */
export type FamilyPinSuggestVariant = "joined" | "startup";

interface FamilyPinSuggestDialogProps {
  variant: FamilyPinSuggestVariant;
  /** Le propriétaire de la famille rejointe (`joined`). */
  owner?: string;
  /** « Configurer plus tard ». `startup` : masque le rappel pour le compte ; `joined` : ferme seulement. */
  onLater: () => void;
  /** Fermée sans réponse (Échap, clic à côté), ou le code posé (ou abandonné) dans son dialogue. */
  onClose: () => void;
}

/**
 * La suggestion du code PIN : pourquoi (son profil s'ouvre depuis « Qui
 * regarde ? » sur les écrans de la famille), puis « Poser un code PIN », qui
 * ouvre le dialogue du code À SA PLACE — jamais deux fenêtres l'une sur
 * l'autre — ou « Configurer plus tard ». Un dégradé posé une fois, sans flou
 * ni animation infinie : rien ne coûte au repos.
 */
export function FamilyPinSuggestDialog({ variant, owner, onLater, onClose }: FamilyPinSuggestDialogProps) {
  const { t } = useTranslation("family");
  const [editing, setEditing] = useState(false);
  const titleId = useId();
  const descId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);

  if (editing) return <OwnPinDialog hasPin={false} onClose={onClose} />;

  const joined = variant === "joined";
  return (
    <Modal
      open
      onClose={onClose}
      maxWidth={440}
      labelledBy={titleId}
      describedBy={descId}
      initialFocus={() => primaryRef.current}
    >
      <div className="relative overflow-hidden p-6 sm:p-7">
        <div className="relative flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-tile bg-accent-soft text-accent"
          >
            <LockKeyhole size={26} />
          </span>
          <p className="ui-eyebrow mt-4">
            {t("pinSuggest.eyebrow")}
          </p>
          <h2 id={titleId} className="mt-1.5 text-heading-3 text-content-primary">
            {joined ? t("pinSuggest.joinedTitle", { owner: owner ?? "" }) : t("pinSuggest.title")}
          </h2>
          <p id={descId} className="mt-2 text-sm leading-relaxed text-content-secondary">
            {joined ? t("pinSuggest.joinedBody") : t("pinSuggest.body")}
          </p>
        </div>

        <p className="relative mt-5 flex gap-3 rounded-tile bg-surface-2 p-4 text-left text-sm leading-relaxed text-content-secondary">
          <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-accent" />
          <span>{t("pinSuggest.why")}</span>
        </p>

        <div className="relative mt-6 flex flex-col gap-2">
          <button
            ref={primaryRef}
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-solid w-full"
          >
            {t("pinSuggest.set")}
          </button>
          <button
            type="button"
            onClick={onLater}
            className="btn btn-ghost w-full"
          >
            {t("pinSuggest.later")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
