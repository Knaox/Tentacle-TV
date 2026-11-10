import { useTranslation } from "react-i18next";
import { CheckIcon as Check } from "@phosphor-icons/react/dist/csr/Check";
import { FolderIcon as Folder } from "@phosphor-icons/react/dist/csr/Folder";
import { useFamilyLibraries, useSetFamilyLibraries } from "@tentacle-tv/api-client";
import { parentalLibraryRows, toggleParentalLibrary, type FamilyProfileDto } from "@tentacle-tv/shared";
import { useToast } from "../../../contexts/ToastContext";
import { useFamilyText } from "../../useFamilyText";

/**
 * Les bibliothèques autorisées d'un profil, dans la fenêtre étroite —
 * `LibrariesSection` du mobile, règle partagée (`familyParentalLibraries`) :
 * une case par bibliothèque de son plafond, tout coché = toutes (celles
 * d'après comprises), la dernière ne se décoche pas. Jellyfin applique aussitôt.
 */
export function NarrowLibrariesSection({ profile }: { profile: FamilyProfileDto }) {
  const { t } = useTranslation("parentalTv");
  const { errorText } = useFamilyText();
  const toast = useToast();
  const libraries = useFamilyLibraries(profile.userId);
  const save = useSetFamilyLibraries();
  const data = libraries.data;
  if (!data) return null;
  // Le geste en vol fait foi le temps de la réponse.
  const allowed = save.isPending ? save.variables?.allowed ?? null : data.allowed;
  const rows = parentalLibraryRows(data.available, allowed);

  const toggle = (id: string) => {
    const next = toggleParentalLibrary(data.available, allowed, id);
    if (next.kind === "last") {
      toast.show("info", t("libraries.keepOne"));
      return;
    }
    save.mutate(
      { userId: profile.userId, allowed: next.allowed },
      { onSuccess: () => toast.show("success", t("saved")), onError: (e) => toast.show("error", errorText(e)) },
    );
  };

  return (
    <div className="mt-3 w-full">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3px] text-content-tertiary">{t("libraries.title")}</p>
      {data.available.length === 0 ? (
        <p className="mt-1 text-[13px] text-content-tertiary">{t("libraries.empty")}</p>
      ) : (
        <ul className="mt-1 flex flex-col">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={row.checked}
                disabled={save.isPending}
                onClick={() => toggle(row.id)}
                className="flex min-h-10 w-full items-center gap-2 text-left text-[14px] text-content-primary disabled:opacity-60"
              >
                <Folder size={15} aria-hidden className="shrink-0 text-content-tertiary" />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="ui-check" data-checked={row.checked}>
                  {row.checked && <Check size={13} aria-hidden />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
