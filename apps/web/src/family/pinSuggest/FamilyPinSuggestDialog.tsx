import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LockKeyhole, ShieldCheck } from "lucide-react";
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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-60"
          style={{ background: "radial-gradient(120% 100% at 50% 0%, rgba(var(--brand-rgb), 0.28), transparent 70%)" }}
        />
        <div className="relative flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-cta-brand-fg shadow-lg"
            style={{ backgroundImage: "var(--cta-brand-gradient)" }}
          >
            <LockKeyhole size={26} />
          </span>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-light)]">
            {t("pinSuggest.eyebrow")}
          </p>
          <h2 id={titleId} className="mt-1.5 text-lg font-bold tracking-tight text-content-primary">
            {joined ? t("pinSuggest.joinedTitle", { owner: owner ?? "" }) : t("pinSuggest.title")}
          </h2>
          <p id={descId} className="mt-2 text-sm leading-relaxed text-content-secondary">
            {joined ? t("pinSuggest.joinedBody") : t("pinSuggest.body")}
          </p>
        </div>

        <p className="relative mt-5 flex gap-3 rounded-xl border border-line-subtle bg-fill-subtle p-4 text-left text-sm leading-relaxed text-content-secondary">
          <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-[var(--brand-light)]" />
          <span>{t("pinSuggest.why")}</span>
        </p>

        <div className="relative mt-6 flex flex-col gap-2">
          <button
            ref={primaryRef}
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg px-5 text-sm font-bold text-cta-brand-fg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            style={{ backgroundImage: "var(--cta-brand-gradient)" }}
          >
            {t("pinSuggest.set")}
          </button>
          <button
            type="button"
            onClick={onLater}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-content-secondary transition-colors hover:bg-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {t("pinSuggest.later")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
