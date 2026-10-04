import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";

/**
 * « Invité · famille de X » — un profil invité de la Famille ne paraît dans
 * AUCUNE liste du serveur, sauf les sessions en cours : là, il se dit tel.
 * Le serveur pose `familyGuestOf` (le nom du propriétaire) ; absent d'un
 * serveur d'avant la Famille, rien ne s'affiche. Le nom est du texte rendu
 * par React, jamais du HTML.
 */
export function FamilyGuestTag({ owner }: { owner: string | null | undefined }) {
  const { t } = useTranslation("family");
  if (!owner) return null;
  return (
    <span className="inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-[rgba(var(--brand-rgb),0.14)] px-2 text-[11px] font-semibold text-[var(--brand-light)]">
      <Users size={12} aria-hidden="true" />
      <span className="truncate">{t("guestOf", { owner })}</span>
    </span>
  );
}
