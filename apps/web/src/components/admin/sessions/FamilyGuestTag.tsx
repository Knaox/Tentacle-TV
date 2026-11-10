import { useTranslation } from "react-i18next";
import { UsersIcon as Users } from "@phosphor-icons/react/dist/csr/Users";

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
    <span className="chip chip-accent max-w-full text-[11px]">
      <Users weight="bold" size={12} aria-hidden="true" />
      <span className="truncate">{t("guestOf", { owner })}</span>
    </span>
  );
}
