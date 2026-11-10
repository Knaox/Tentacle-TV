import { ShareNetworkIcon } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePublicSharingAllowed } from "@tentacle-tv/api-client";
import { ShareLinkModal } from "./ShareLinkModal";

interface Props {
  /** Liste partagée : « Ma liste » (défaut) ou les titres likés. */
  kind?: "watchlist" | "likes";
}

/**
 * Bouton « Partager ma liste » — ouvre le modal de lien de partage.
 *
 * Un geste SECONDAIRE, mais qu'on doit trouver sans le chercher : il était
 * gris sur gris (`fill-subtle`), sans liseré, et se fondait dans la rangée.
 * Il prend le ton de la marque — aplat opaque teinté de violet, liseré et
 * texte violets — sans le dégradé plein réservé à l'action principale d'un
 * écran. 32 px de haut, comme les pastilles et menus du panneau qui
 * l'accueille. `kind` et le modal n'ont pas changé : la page publique
 * `/share/:token` reçoit le même lien.
 */
export function ShareMyListButton(props: Props) {
  // Le droit « Partage public » de Jellyfin (capacité `share.publicRight`) : sans lui, aucun bouton.
  return usePublicSharingAllowed() ? <ShareMyListButtonView {...props} /> : null;
}

function ShareMyListButtonView({ kind = "watchlist" }: Props) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        // La pilule du socle, comme ses voisines de la barre d'outils : plus de teinte ni
        // d'anneau de marque — partager n'est pas un état actif.
        className="lg-content-control btn btn-soft btn-sm"
      >
        <ShareNetworkIcon size={15} aria-hidden />
        {t(kind === "likes" ? "common:shareMyFavorites" : "common:shareMyList")}
      </button>
      {open && <ShareLinkModal kind={kind} onClose={() => setOpen(false)} />}
    </>
  );
}
