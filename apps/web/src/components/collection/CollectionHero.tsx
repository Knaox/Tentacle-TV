import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { HeroAmbilight } from "../hero/HeroAmbilight";
import { firstBackdropItem, heroBackdropUrl, resolveBackdropId } from "../hero/resolveBackdrop";
import { useInViewport } from "../../hooks/useInViewport";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import { itemImageColor } from "../../lib/itemImageColor";
import { HeroScrims } from "../hero/HeroScrims";
import { BannerArt } from "../library/BannerArt";
import { BannerHeading } from "../library/BannerHeading";

interface CollectionHeroProps {
  title: string;
  /** Sur-titre : « Ma liste », « Mes favoris » — déjà traduit. */
  kicker: string;
  /** La collection, telle qu'elle est chargée. Le sujet en sort. */
  items: MediaItem[] | undefined;
  /** Compte affiché sous le titre, déjà formaté et traduit. */
  subtitle?: string;
}

/**
 * La bannière de Ma liste et de Mes favoris — la grammaire de `LibraryHero`,
 * au mot près : boîte de mise en page, boîte image qui déborde de 200 px, la
 * même pile de voiles, la même lueur de raccord.
 *
 * Une seule différence, et c'est la bonne : ZÉRO requête. La bibliothèque tire
 * un fond au hasard parmi ses titres ; ici le sujet est le premier de la
 * collection, déjà en mémoire. Une liste qu'on a soi-même constituée n'a pas
 * besoin qu'on lui cherche une vitrine.
 *
 * Sur une liste vide, rien n'est rendu : une bannière noire sous un écran qui
 * dit « ajoutez des titres » n'annonce rien.
 */
export function CollectionHero({ title, kicker, items, subtitle }: CollectionHeroProps) {
  const client = useJellyfinClient();
  const { ref: boxRef, visible } = useInViewport<HTMLDivElement>("200px");

  const featured = firstBackdropItem(items);
  const backdropId = featured ? resolveBackdropId(featured) : null;
  const { broken, reportFailure } = useBrokenImage(backdropId ?? undefined);
  const url = heroBackdropUrl(client, featured ?? undefined);
  const tone = itemImageColor(featured, "Backdrop");

  if (!items || items.length === 0) return null;

  return (
    <section className="relative w-full" aria-label={title}>
      <div ref={boxRef} className="absolute inset-x-0 top-0 -bottom-[200px] overflow-hidden">
        <div className="absolute inset-0 bg-surface-0" style={tone ? { backgroundColor: tone } : undefined} />

        {/* UN fondu sur la couleur de l'image ; déjà vue, elle est là d'emblée (`BannerArt`). */}
        {url && <BannerArt key={backdropId} url={url} broken={broken} onError={reportFailure} />}

        {/* Raccord vers la page (jeton `--hero-page-fade`, `none` en sombre).
            Sans lui, en thème clair, l'assise noire du bas de l'image
            s'arrêtait net 200 px sous la réserve, et tout ce qui chevauche la
            bannière — bas du panneau, pastilles, « Reprendre », tuiles du
            bilan — tombait en texte sombre sur du noir. Hauteur en pixels et
            non en pour cent : le calque doit commencer SOUS le sous-titre
            (ancré à 18 % d'une réserve d'au moins 220 px) et finir opaque là
            où la page reprend, quelle que soit la hauteur de fenêtre. */}
        <HeroScrims bottom="h-[62%]" seam="h-[240px]" />
      </div>

      {/* Le bord bas de la boîte image, recouvert d'une bande de page. Le
          compositeur y laissait un filet sombre d'un pixel (le découpage
          `overflow-hidden` des voiles noirs, arrondi en pixels physiques),
          invisible sur le fond sombre, net sur le fond clair — même avec un
          raccord opaque au-dessus. La bande vaut `--surface-0` : en sombre,
          c'est déjà la couleur du bas de la boîte. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-[202px] h-1 bg-surface-0" />

      {/* Démontée hors écran : une image floutée à 48 px sur toute la largeur,
          doublée d'un `mix-blend-mode`, reste composée à chaque image tant
          qu'elle est dans l'arbre — et on passe l'essentiel de son temps ici à
          parcourir la grille, très en dessous. */}
      {visible && (
        <HeroAmbilight
          item={featured ?? undefined}
          opacity="var(--detail-ambilight-opacity)"
          className="hero-glow absolute inset-x-0 top-0 h-[calc(32vh+350px)] md:h-[calc(36vh+350px)]"
        />
      )}

      {/* Réserve de mise en page — plus courte que celle d'une bibliothèque :
          ces pages sont des listes de travail, la grille doit rester à portée
          de regard. */}
      <div className="h-[32vh] min-h-[220px] w-full md:h-[36vh]" aria-hidden />

      <BannerHeading kicker={kicker} title={title} subtitle={subtitle} />
    </section>
  );
}
