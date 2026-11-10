import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useLatestItems, useLibraryCatalogCounts, useRandomLibraryBackdrop, type CatalogFilters } from "@tentacle-tv/api-client";
import { HeroAmbilight } from "../hero/HeroAmbilight";
import { heroBackdropUrl, libraryBannerItem, resolveBackdropId } from "../hero/resolveBackdrop";
import { useInViewport } from "../../hooks/useInViewport";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import { itemImageColor } from "../../lib/itemImageColor";
import { HeroScrims } from "../hero/HeroScrims";
import { BannerArt } from "./BannerArt";
import { BannerHeading, type BannerStat } from "./BannerHeading";

interface LibraryHeroProps {
  libraryId: string;
  libraryName: string;
  collectionType?: string;
}

/**
 * Les nombres de l'en-tête : le total, puis ce qui reste à voir, ce qui est entamé, ce qu'on
 * aime. Quatre requêtes d'UN titre sans image ni champ (`useLibraryCatalogCounts`, gardées dix
 * minutes) — une constante de module : la liste nomme les clés de cache.
 */
const HEADER_COUNTS: readonly CatalogFilters[] = [
  {},
  { statusFilter: "IsUnplayed" },
  { statusFilter: "IsResumable" },
  { isFavorite: true },
];

/**
 * En-tête de page bibliothèque : même grammaire que la bannière d'accueil
 * (scrim diagonal, voile de marque, ligne de lumière), en version courte —
 * la page est un catalogue, pas une vitrine, la grille doit rester à portée
 * de regard sans défilement.
 *
 * Le backdrop est un item ALÉATOIRE de la bibliothèque (`useRandomLibraryBackdrop`),
 * tiré une fois par session puis mis en cache — pas d'appel à chaque visite.
 * Repli sur le premier des « Derniers ajouts » (`useLatestItems`, souvent déjà
 * en cache) quand le tirage ne renvoie rien — petite bibliothèque, aucun backdrop.
 */
export function LibraryHero({ libraryId, libraryName, collectionType }: LibraryHeroProps) {
  const { t } = useTranslation(["common", "library"]);
  const client = useJellyfinClient();
  const { counts } = useLibraryCatalogCounts(libraryId, HEADER_COUNTS);
  const random = useRandomLibraryBackdrop(libraryId);
  const { data: latest } = useLatestItems(libraryId, { collectionType });
  // Bannière réellement à l'écran ET fenêtre au premier plan — sert à démonter
  // le halo flouté dès qu'on défile dans la grille (cf. plus bas).
  const { ref: boxRef, visible } = useInViewport<HTMLDivElement>("200px");

  // Le repli n'attend pas à la place du tirage : il ne vient qu'après lui.
  const featured = libraryBannerItem(random, latest);
  const backdropId = featured ? resolveBackdropId(featured) : null;
  const { broken, reportFailure } = useBrokenImage(backdropId ?? undefined);
  // La MÊME URL que l'accueil, à la lettre — `heroBackdropUrl` est la
  // définition unique. Elle était recopiée ici à la main, et la copie avait
  // dérivé d'un cran de qualité (82 contre 85). Trois pixels de moins par bloc
  // JPEG dans un dégradé sombre, c'est exactement là que ça se voit ; et un
  // second jeu de paramètres, c'est un second téléchargement là où le cache
  // aurait suffi.
  const url = heroBackdropUrl(client, featured ?? undefined);
  // La couleur de l'image d'abord (son blurhash), puis UN fondu — jamais un noir qui attend.
  const tone = itemImageColor(featured, "Backdrop");

  const [total, unwatched, inProgress, favorites] = counts;
  const stats = useMemo<BannerStat[]>(() => {
    if (total === undefined) return [];
    const list: BannerStat[] = [{ key: "total", label: t("library:titles", { count: total }) }];
    if (unwatched) list.push({ key: "unwatched", label: t("library:statUnwatched", { count: unwatched }) });
    if (inProgress) list.push({ key: "inProgress", label: t("library:statInProgress", { count: inProgress }) });
    if (favorites) list.push({ key: "favorites", label: t("library:statFavorites", { count: favorites }) });
    return list;
  }, [t, total, unwatched, inProgress, favorites]);

  return (
    /**
     * Même construction que la bannière de fiche média : une boîte de MISE EN
     * PAGE (44/48 vh) et une boîte IMAGE qui déborde de 200 px en dessous.
     *
     * Confondues, l'image devait finir de s'éteindre avant son propre bord et le
     * dégradé passait de visible à opaque en une centaine de pixels — la bande
     * signalée. Avec du rab, le fondu se termine sous la barre de filtres, là où
     * personne ne le voit.
     */
    <section className="relative w-full" aria-label={libraryName}>
      <div ref={boxRef} className="absolute inset-x-0 top-0 -bottom-[200px] overflow-hidden">
        {/* L'assise de l'image : sa couleur dès qu'on la connaît. En thème CLAIR, une encre sombre
            en attendant — le titre posé dessus est blanc (`on-media`), et les voiles noirs sur le
            papier donnaient un gris sale. `bg-surface-0` reste : la feuille du client LG la vise. */}
        <div className="absolute inset-0 bg-surface-0 [[data-theme=light]_&]:bg-[#131315]" style={tone ? { backgroundColor: tone } : undefined} />

        {/* UN fondu sur la couleur de l'image ; déjà vue, elle est là d'emblée (`BannerArt`). */}
        {url && <BannerArt key={backdropId} url={url} broken={broken} onError={reportFailure} />}

        {/* La MÊME pile que l'accueil, au sens propre : le même composant, les
            mêmes cotes. Elle en différait sur deux points, tous deux mesurés
            comme coûteux sur une dalle.

            La rampe basse valait `h-[76%]`, dimensionnée pour une boîte qui
            DÉBORDE de 200 px sous le bas visible : ses quinze derniers pour
            cent, la montée vers l'opaque, tombaient hors champ. Sur le
            téléviseur la carte s'arrête à son bord (`bibliotheque-tv.css`) et
            la même montée se jouait dans les cinquante derniers pixels — une
            rampe vingt pour cent plus raide que celle de l'accueil, donc des
            paliers là où l'accueil n'en a pas. On reprend sa proportion.

            Et le raccord de page en plus. En thème sombre son jeton vaut
            `none` sur le web : le calque ne peignait rien, et personne ne l'a
            vu dériver. La feuille du téléviseur, elle, le redéfinit en vrai
            dégradé — d'où une SIXIÈME couche quantifiée sur huit bits empilée
            sur les cinq autres, dans la zone la plus sombre de l'image. */}
        <HeroScrims bottom="h-[62%]" />
        {/* Thème CLAIR seulement : le raccord vers la page (`--hero-page-fade`). Sans lui, l'assise
            noire du bas de l'image s'arrêtait net sous le panneau d'outils. Masqué en sombre —
            donc sur le téléviseur, toujours sombre — : aucune couche de plus à y composer. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[240px] [[data-theme=light]_&]:block"
          style={{ background: "var(--hero-page-fade)" }}
        />
      </div>

      {/* Lueur de raccord — l'affiche floutée en fusion `screen` par-dessus le
          bas de la bannière (cf. `.hero-glow`). Boîte calée pour que la couture
          (bas de la boîte image, +200 px) tombe dans la zone pleine du masque,
          avec 150 px de débord dans la page. */}
      {/* Démontée hors écran, comme sur l'accueil et la fiche média — c'est la
          dernière des trois bannières où elle restait montée en toutes
          circonstances. Une image floutée à 48 px étalée sur toute la largeur,
          doublée d'un `mix-blend-mode`, reste composée à chaque image tant
          qu'elle est dans l'arbre, même parfaitement immobile ; or on passe
          l'essentiel de son temps sur cette page à parcourir la grille, très
          en dessous. La marge de 200 px du hook la remonte AVANT l'entrée dans
          le champ, pour qu'on ne surprenne jamais son fondu d'apparition. */}
      {visible && (
        <HeroAmbilight
          item={featured ?? undefined}
          opacity="var(--detail-ambilight-opacity)"
          className="hero-glow absolute inset-x-0 top-0 h-[calc(44vh+350px)] md:h-[calc(48vh+350px)]"
        />
      )}

      {/* Réserve de mise en page : la boîte image étant hors flux, c'est elle
          qui occupe la place et sur laquelle la barre de filtres s'appuie. */}
      <div className="h-[44vh] min-h-[300px] w-full md:h-[48vh]" aria-hidden />

      {/* Titre ancré sur la RÉSERVE, pas sur la boîte image : celle-ci déborde
          de 200 px, un `bottom-[18%]` calculé dessus aurait fait descendre le
          titre d'autant. Le nom de la bibliothèque dit déjà « Films » ou
          « Séries » : le sur-titre reste un libellé de section neutre. */}
      <BannerHeading kicker={t("common:librariesTitle")} title={libraryName} stats={stats} />
    </section>
  );
}
