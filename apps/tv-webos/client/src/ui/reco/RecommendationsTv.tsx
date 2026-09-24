import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  recoRowTitle, useMediaItem, useRecoPage, useRecoSettings, type RecoRowItem,
} from "@tentacle-tv/api-client";
import { tvRecoHero, tvRecoNotice, tvRecoShelves, type TvRecoShelf } from "@tentacle-tv/tv-core";
import { PageTransition } from "@/components/PageTransition";
import { MediaRow } from "../rows/RowTv";
import { RecoHeroTv } from "./RecoHeroTv";
import { recoLibraryItems } from "./recoMediaItem";

const EMPTY: number[] = [];

/**
 * « Pour vous », pensé pour la télévision : une tête (le titre que le moteur
 * place le plus haut, s'il est sur le serveur), puis des étagères de la
 * BIBLIOTHÈQUE — sans doublon d'une rangée à l'autre, bornées, sans rien
 * qu'il faudrait aller demander ailleurs (`tvRecoShelves`, commun avec l'Apple
 * TV et Android TV).
 *
 * Le filtre de plateformes du compte s'applique, en lecture seule : il se règle
 * depuis le téléphone ou l'ordinateur. On l'attend avant de demander la page —
 * sans cette garde, la page « toutes plateformes » partirait avant la bonne.
 *
 * Les étagères sont des rangées du téléviseur (`RowTv`) : mêmes cartes, même
 * piste, même fond d'ambiance que l'accueil. Une phrase dit l'état de la page
 * quand il y a quelque chose à en dire — désactivée, à froid, en préparation,
 * vide : jamais un écran blanc.
 */
export function RecommendationsTv() {
  const { t } = useTranslation("reco");
  const settings = useRecoSettings();
  const settingsReady = settings.isSuccess || settings.isError;
  const { data: page, isError } = useRecoPage(settings.data?.providerFilter ?? EMPTY, { enabled: settingsReady });

  const hero = useMemo(() => tvRecoHero(page), [page]);
  const shelves = useMemo(() => tvRecoShelves(page, { hero }), [page, hero]);
  const notice = tvRecoNotice(page, shelves);
  const { data: heroItem } = useMediaItem(hero?.jellyfinItemId ?? undefined);

  const noticeText = notice === "disabled" ? t("tvDisabledHint")
    : notice === "cold" ? t("tvColdHint")
    : notice === "preparing" ? t("generatingHint")
    : page && shelves.length === 0 && !hero ? t("tvEmpty")
    : null;
  const loading = !page && !isError;

  return (
    <PageTransition>
      {/* `relative z-10` : le décor de la carte visée (`fond-focus`, fixe) est
          peint après tout contenu statique — sans lui, il passerait devant. */}
      <div className="relative z-10 pb-24">
        {hero && heroItem ? (
          <RecoHeroTv reco={hero} item={heroItem} />
        ) : (
          (loading || hero) && <HeroPlaceholder />
        )}
        {noticeText && <p className="reco-tv-notice">{noticeText}</p>}
        {shelves.map((shelf, index) => (
          <Shelf key={shelf.key} shelf={shelf} animDelay={Math.min(index * 60, 240)} />
        ))}
      </div>
    </PageTransition>
  );
}

/** Une étagère : son titre (`recoRowTitle`, clé du namespace `reco`) et ses titres. */
const Shelf = memo(function Shelf({ shelf, animDelay }: { shelf: TvRecoShelf<RecoRowItem>; animDelay: number }) {
  const { t } = useTranslation("reco");
  const items = useMemo(() => recoLibraryItems(shelf.items), [shelf.items]);
  const { key, params } = recoRowTitle(shelf);
  return <MediaRow title={t(key, params)} items={items} animDelay={animDelay} />;
});

/** La place de la tête, tenue le temps que la page ou la fiche du titre arrive. */
function HeroPlaceholder() {
  return (
    <div className="px-[var(--row-gutter-mobile)] pb-6 md:px-[var(--row-gutter-desktop)] md:pb-10">
      <div className="h-[62vh] w-full rounded-[var(--hero-frame-radius)] bg-surface-1" />
    </div>
  );
}
