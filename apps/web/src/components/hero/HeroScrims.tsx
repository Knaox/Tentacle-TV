/**
 * La pile de voiles d'une bannière — une seule, pour les trois.
 *
 * L'accueil, la bibliothèque et la fiche média posent la même grammaire :
 * scrim diagonal, voile de marque, voile bas, raccord vers la page, vignette
 * haute, grain. Elle a été recopiée trois fois, et les trois copies ont dérivé
 * — une rampe basse plus raide ici, un calque de raccord en plus là, un grain
 * en moins ailleurs. Chaque écart s'est ensuite payé sur un téléviseur, où la
 * même image ne rendait pas pareil selon la page qui la portait.
 *
 * Ce composant n'ajoute AUCUNE classe et ne change AUCUN ordre : le balisage
 * qu'il rend est celui que les trois appelants rendaient déjà, à la lettre.
 * C'est ce qui permet de le poser sans rien mesurer d'autre que l'égalité des
 * sorties (cf. `HeroScrims.test.ts`).
 */

export interface HeroScrimsProps {
  /**
   * Famille de jetons. `hero` pour l'accueil et la bibliothèque, `detail` pour
   * la fiche — deux jeux distincts, réglés séparément dans `theme/scrims.css`.
   */
  tokenSet?: "hero" | "detail";
  /** Hauteur du voile bas : la seule cote qui varie vraiment d'une page à l'autre. */
  bottom: string;
  /** Hauteur de la vignette haute. */
  top?: string;
  /**
   * Raccord vers la page, ou `null` pour n'en poser aucun.
   *
   * `null` n'est pas la même chose qu'un jeton valant `none` : le calque
   * n'existe pas du tout, donc il n'y a rien à composer. L'accueil s'en passe
   * depuis que sa bannière est encadrée — son bord bas est un vrai bord, net,
   * et le fondu n'y raccordait plus rien.
   */
  seam?: string | null;
  /**
   * Grain anti-banding.
   *
   * Une pile de dégradés sur huit bits produit des paliers visibles dans les
   * zones sombres ; un bruit à un pixel les dissout. Pas de `mix-blend-mode` —
   * il fabriquait un rectangle blanc fantôme dans la WebView de macOS.
   */
  grain?: boolean;
}

export function HeroScrims({
  tokenSet = "hero",
  bottom,
  top = "h-40",
  seam = null,
  grain = true,
}: HeroScrimsProps) {
  return (
    <>
      {/* Le scrim principal est DIAGONAL (72deg) : son coin sombre tombe en
          bas-gauche, pile sous la colonne de texte, là où le 90deg d'origine
          assombrissait tout le flanc gauche à hauteur égale. */}
      <div className="absolute inset-0" style={{ background: `var(--${tokenSet}-scrim-diagonal)` }} />
      {/* Voile de marque : c'est lui qui rend l'ombre VIOLETTE plutôt que
          neutre. Alphas volontairement bas — au-delà l'affiche vire au
          monochrome. Construit sur `--brand-rgb`, donc une surcharge de thème
          depuis l'admin le suit sans une ligne de code. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `var(--${tokenSet}-brand-wash)` }}
        aria-hidden
      />
      {/* Assise NOIRE constante sous le texte on-media, dans les DEUX schémas :
          recette mobile, l'affiche reste vive, aucun voile clair ni flou. */}
      <div
        className={`absolute inset-x-0 bottom-0 ${bottom}`}
        style={{ background: `var(--${tokenSet}-scrim-bottom)` }}
      />
      {seam && (
        /* En thème clair, ce qui remonte sur la bannière — barre de filtres,
           méta, synopsis — est en texte THÉMÉ, donc sombre, et se retrouverait
           posé sur une affiche vive. Ce calque lui rend une assise de page. En
           sombre, le jeton vaut `none` et le calque ne peint rien. */
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 ${seam}`}
          style={{ background: `var(--${tokenSet}-page-fade)` }}
          aria-hidden
        />
      )}
      {/* Vignette haute sous la barre de navigation — la nav est en texte
          thémé, son assise suit le schéma. */}
      <div
        className={`absolute inset-x-0 top-0 ${top}`}
        style={{ background: `var(--${tokenSet}-scrim-top)` }}
      />
      {grain && <div className="noise-texture absolute inset-0 opacity-[0.06]" aria-hidden />}
      {/* PAS de ligne de lumière en couture basse, sur aucune des trois. L'idée
          supposait une couture VISIBLE ; or ce qui suit la bannière remonte de
          40 à 192 px selon la page et reste transparent, si bien que la
          hairline se retrouvait tracée en travers du contenu — première rangée
          d'affiches, barre de recherche, ou synopsis. Le geste ne tient sur
          aucune des trois surfaces ; il est abandonné partout. */}
    </>
  );
}
