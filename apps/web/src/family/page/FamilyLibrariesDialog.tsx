import { useEffect, useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Library } from "lucide-react";
import { useFamilyLibraries, useSetFamilyLibraries } from "@tentacle-tv/api-client";
import type { FamilyProfileDto } from "@tentacle-tv/shared";
import { useToast } from "../../contexts/ToastContext";
import { Modal } from "../../components/ui/Modal";
import { useFamilyText } from "../useFamilyText";
import { draftVerdict, initialDraft, isChecked, toggleAll, toggleLibrary, type LibrariesDraft } from "./familyLibrariesModel";
import { BRAND_BUTTON, BRAND_BUTTON_STYLE, SECONDARY_BUTTON } from "./familyUi";

const CHECKBOX = "h-4 w-4 shrink-0 accent-[var(--brand)]";

/**
 * Les bibliothèques d'un invité ou d'un membre mineur (serveur 1.30.0,
 * `family.libraryLimits`) — mêmes droits que son contrôle parental. « Toutes
 * les bibliothèques » ou une liste ; « Enregistrer » envoie la liste ENTIÈRE,
 * et c'est le serveur qui l'écrit dans la politique Jellyfin du profil, jamais
 * plus large que son plafond (son créateur, ou l'administrateur).
 */
export function FamilyLibrariesDialog({ profile, onClose }: { profile: FamilyProfileDto; onClose: () => void }) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  const toast = useToast();
  const titleId = useId();
  const introId = useId();
  const allId = useId();
  const libraries = useFamilyLibraries(profile.userId);
  const save = useSetFamilyLibraries();
  const available = libraries.data?.available ?? [];
  const initial: LibrariesDraft = libraries.data ? initialDraft(libraries.data.allowed, libraries.data.available) : null;
  const [draft, setDraft] = useState<LibrariesDraft | undefined>(undefined);
  // Le brouillon part de la réponse du serveur, une fois.
  useEffect(() => {
    if (libraries.data && draft === undefined) setDraft(initialDraft(libraries.data.allowed, libraries.data.available));
  }, [libraries.data, draft]);

  const current = draft === undefined ? initial : draft;
  const verdict = draftVerdict(current, initial);
  const pending = save.isPending;
  const close = pending ? () => undefined : onClose;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (verdict === "unchanged") return onClose();
    if (verdict === "empty") return;
    save.mutate({ userId: profile.userId, allowed: current }, {
      onSuccess: () => {
        toast.show("success", t("libraries.saved"));
        onClose();
      },
      onError: (error) => toast.show("error", errorText(error)),
    });
  };

  return (
    <Modal open onClose={close} maxWidth={480} labelledBy={titleId} describedBy={introId} dismissOnBackdrop={false}>
      <form onSubmit={submit} noValidate className="flex max-h-[85dvh] flex-col">
        <header className="flex items-start gap-3 border-b border-line-subtle p-6 pb-4">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-cta-brand-fg" style={BRAND_BUTTON_STYLE}>
            <Library size={20} />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{t("libraries.title", { name: profile.name })}</h2>
            <p id={introId} className="mt-1 text-sm leading-relaxed text-content-tertiary">{t("libraries.intro", { name: profile.name })}</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {libraries.isError ? (
            <p role="alert" className="text-sm text-status-error-fg">{errorText(libraries.error)}</p>
          ) : !libraries.data ? (
            <p aria-live="polite" className="text-sm text-content-tertiary">{t("libraries.loading")}</p>
          ) : available.length === 0 ? (
            <p className="text-sm text-content-tertiary">{t("libraries.empty", { name: profile.name })}</p>
          ) : (
            <fieldset disabled={pending} className="space-y-1">
              <legend className="sr-only">{t("libraries.title", { name: profile.name })}</legend>
              <label htmlFor={allId} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-fill-subtle">
                <input id={allId} type="checkbox" className={`${CHECKBOX} mt-0.5`} checked={current === null}
                  onChange={() => setDraft(toggleAll(current, available))} />
                <span>
                  <span className="block text-sm font-semibold text-content-primary">{t("libraries.all")}</span>
                  <span className="block text-xs text-content-tertiary">{t("libraries.allHint")}</span>
                </span>
              </label>
              <ul className="ml-7 space-y-1 border-l border-line-subtle pl-3">
                {available.map((library) => (
                  <li key={library.id}>
                    <label className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-content-primary ${current === null ? "opacity-60" : "cursor-pointer hover:bg-fill-subtle"}`}>
                      <input type="checkbox" className={CHECKBOX} checked={isChecked(current, library.id)} disabled={current === null}
                        onChange={() => setDraft(toggleLibrary(current, library.id))} />
                      {library.name}
                    </label>
                  </li>
                ))}
              </ul>
              {verdict === "empty" && <p role="alert" className="pt-2 text-xs text-status-error-fg">{t("libraries.atLeastOne")}</p>}
            </fieldset>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line-subtle p-4">
          <button type="button" onClick={onClose} disabled={pending} className={SECONDARY_BUTTON}>{t("parental.cancel")}</button>
          <button type="submit" disabled={pending || !libraries.data || verdict !== "ready"} className={BRAND_BUTTON} style={BRAND_BUTTON_STYLE}>
            {t("libraries.save")}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
