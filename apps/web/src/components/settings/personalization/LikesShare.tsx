import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMyShareLink } from "@tentacle-tv/api-client";
import { SettingsSection } from "@tentacle-tv/ui";
import { ShareLinkModal } from "../../share/ShareLinkModal";

/**
 * Section « Partage » de Personnalisation : le lien public des titres likés
 * (favoris + likes hors bibliothèque). Réutilise la modale de partage de la
 * watchlist, paramétrée par `kind` — génération, copie, révocation identiques.
 * Le lien n'expose QUE la liste : cinq champs par titre, rien d'autre.
 */
export function LikesShare() {
  const { t } = useTranslation("preferences");
  const [open, setOpen] = useState(false);
  const { data } = useMyShareLink(true, "likes");

  return (
    <SettingsSection title={t("persoShareTitle")} caption={t("persoShareCaption")}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs leading-relaxed text-content-tertiary">
          {data?.token ? t("persoShareActive") : t("persoShareInactive")}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full border border-line-strong px-4 py-1.5 text-sm text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
        >
          {t("persoShareManage")}
        </button>
      </div>
      {open && <ShareLinkModal kind="likes" onClose={() => setOpen(false)} />}
    </SettingsSection>
  );
}
