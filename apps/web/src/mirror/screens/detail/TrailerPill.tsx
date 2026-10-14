import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Film } from "lucide-react";
import { useItemTrailer } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useWebTrailerPlatform } from "../../../components/detail/trailerPlatform";
import { CatalogTrailerPlayer } from "../../../components/detail/CatalogTrailerPlayer";

/**
 * `DetailTrailerButton` de l'app : la bande-annonce, sous « Lecture » — une
 * pilule SECONDAIRE de même largeur (420 au plus), 48 de haut, en verre
 * neutre : une seule action en couleur par fiche, et le libellé entier plutôt
 * qu'un cinquième rond où « Bande-annonce » ne tiendrait pas.
 *
 * Même règle que partout (`useItemTrailer`) : la première du CATALOGUE du
 * serveur dans le lecteur complet, sans publicité ; sans lui, la LOCALE dans
 * le lecteur, sinon la distante dans un nouvel onglet — l'app YouTube du
 * téléphone la reprend —, et rien quand il n'y en a aucune. La flèche dit
 * qu'on quitte la page.
 */
export const TrailerPill = memo(function TrailerPill({ item, maxWidth }: { item: MediaItem; maxWidth: number }) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const { target, visible, entries, language } = useItemTrailer(item, i18n.language, useWebTrailerPlatform());
  const [playerOpen, setPlayerOpen] = useState(false);
  if (!visible) return null;
  const external = target?.kind === "remote";

  const open = () => {
    if (!target) return;
    if (target.kind === "local") navigate(`/watch/${target.itemId}`);
    else if (target.kind === "relay") setPlayerOpen(true);
    else if (target.kind === "remote") window.open(target.trailer.Url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={external ? `${t("watchTrailer")}, ${t("trailerOpensYoutube")}` : t("watchTrailer")}
        className="mirror-detail-fade-press flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-line-subtle bg-fill-subtle px-5 text-content-primary"
        style={{ maxWidth }}
      >
        <Film size={18} strokeWidth={2} aria-hidden />
        <span className="truncate text-[15px] font-semibold tracking-[0.2px]">{t("trailer")}</span>
        {external && <ArrowUpRight size={16} strokeWidth={2} aria-hidden className="text-content-secondary" />}
      </button>
      {playerOpen && target?.kind === "relay" && (
        <CatalogTrailerPlayer entries={entries} start={target.entry} language={language} onClose={() => setPlayerOpen(false)} />
      )}
    </>
  );
});
