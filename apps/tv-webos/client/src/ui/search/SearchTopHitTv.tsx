import { memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { itemMeta, matchReason, type SearchTopHit } from "@tentacle-tv/shared";
import { captureDetailOrigin } from "@/components/detail/detailTransition";
import { SearchPortraitTv } from "./SearchPersonTv";

/**
 * Le meilleur résultat, en tête : une bannière qu'un seul appui ouvre. Un
 * titre y montre son fond, son logo et POURQUOI il répond (« Avec Camille
 * Durand ») ; une personne, son portrait et ce qu'elle représente ici —
 * l'appui ouvre alors sa filmographie dans la bibliothèque.
 *
 * Même grammaire que `TVSearchTopHit` des téléviseurs natifs. Le fond est un
 * Backdrop à la largeur de la bannière, pas de l'écran : il n'est vu qu'ici.
 */
export const SearchTopHitTv = memo(function SearchTopHitTv({ top, onOpenItem, onOpenPerson }: {
  top: SearchTopHit;
  onOpenItem: (itemId: string) => void;
  onOpenPerson: (opener: HTMLElement) => void;
}) {
  const { t, i18n } = useTranslation("search");
  const client = useJellyfinClient();
  const frame = useRef<HTMLButtonElement>(null);

  if (top.kind === "person") {
    const person = top.hit;
    return (
      <button
        ref={frame}
        type="button"
        className="tv-search-top"
        data-kind="person"
        aria-label={person.name}
        onClick={() => frame.current && onOpenPerson(frame.current)}
      >
        <span className="tv-search-top-person">
          <SearchPortraitTv person={person} size={176} />
          <span className="tv-search-top-text">
            <span className="tv-search-kicker">{t("topResult")}</span>
            <span className="tv-search-top-title">{person.name}</span>
            <span className="tv-search-top-meta">{t("filmography")}</span>
          </span>
        </span>
      </button>
    );
  }

  const { item, match } = top.hit;
  const backdropTag = item.BackdropImageTags?.[0];
  const backdrop = backdropTag
    ? client.getImageUrl(item.Id, "Backdrop", { width: 1280, tag: backdropTag, quality: 80 })
    : null;
  const logoTag = item.ImageTags?.Logo;
  const logo = logoTag ? client.getImageUrl(item.Id, "Logo", { width: 500, tag: logoTag, quality: 90 }) : null;
  const reason = matchReason(t, match);

  const open = () => {
    // Le cadre vole jusqu'à la fiche, comme depuis la bannière d'accueil : le
    // rectangle n'existe plus une fois la route changée, on le mesure ici.
    const element = frame.current;
    if (element && backdrop) {
      const radius = Number.parseFloat(window.getComputedStyle(element).borderTopLeftRadius) || 0;
      captureDetailOrigin(element, item.Id, backdrop, radius);
    }
    onOpenItem(item.Id);
  };

  return (
    <button ref={frame} type="button" className="tv-search-top" data-kind="item" aria-label={item.Name} onClick={open}>
      {backdrop && <img className="tv-search-top-backdrop" src={backdrop} alt="" draggable={false} />}
      <span className="tv-search-top-scrim" aria-hidden />
      <span className="tv-search-top-text">
        <span className="tv-search-kicker">{t("topResult")}</span>
        {logo ? (
          <img className="tv-search-top-logo" src={logo} alt={item.Name} draggable={false} />
        ) : (
          <span className="tv-search-top-title">{item.Name}</span>
        )}
        <span className="tv-search-top-meta">{itemMeta(t, item, i18n.language)}</span>
        {reason && <span className="tv-search-top-reason">{reason}</span>}
      </span>
    </button>
  );
});
