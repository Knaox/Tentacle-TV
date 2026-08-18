import type { PartialThemeTokens } from "../types";

/**
 * La couche téléviseur du thème — ce que la distance de lecture change.
 *
 * Ces valeurs vivaient dans `apps/tv-webos/client/src/styles/tokens-tv.css`,
 * où elles n'existaient que sous forme de texte CSS : invisibles depuis le
 * JavaScript, donc impossibles à partager avec les clients natifs. Elles sont
 * désormais des DONNÉES, et les deux cibles les lisent d'ici :
 *
 * - webOS les reçoit en variables CSS (`partialThemeToCssVarEntries`), posées
 *   après `index.css` — même cascade, même résultat qu'avant.
 * - Apple TV et Android TV les lisent directement, converties en nombres par
 *   `parsePx`/`parseMs` (`../native/units`).
 *
 * Le vocabulaire ne s'élargit pas : chaque clé ci-dessous existe déjà dans
 * `CSS_VAR_NAMES`, ce qui garde intact le contrat vérifié par `cssVars.test.ts`.
 * Ce qui n'appartient pas au vocabulaire du thème est plus bas, dans
 * `TV_ONLY_TOKENS`.
 */
export const TV_THEME_TOKEN_OVERRIDES: PartialThemeTokens = {
  color: {
    /* Surfaces opaques.
     *
     * Sur le web ces surfaces sont translucides parce qu'un flou d'arrière-plan
     * les rend lisibles. Ce flou n'arrive qu'avec Chrome 76, et il a été retiré
     * de la cible téléviseur : sans opacité, une barre de navigation ou un menu
     * laisserait voir l'affiche nette qui passe dessous, et à trois mètres plus
     * rien n'est lisible.
     *
     * L'alpha ne descend jamais sous 1 : le compositeur d'une dalle paie chaque
     * couche transparente, et il n'y a rien à gagner à en laisser. */
    glass: {
      tint: "#14141a",
      tintStrong: "#0a0a12",
      panel: "#0a0a0a",
      backdrop: "rgba(0, 0, 0, 0.86)",
    },
    surface: {
      modal: "#0f0f15",
      dropdown: "#14141a",
      sheet: "#0f0f15",
      toolbar: "#14141a",
      overlay: "rgba(0, 0, 0, 0.86)",
    },
    /* Bordures relevées : une bordure à 8 % d'opacité disparaît sur une dalle
     * vue de loin, et c'est elle qui sépare une carte de sa voisine. */
    border: {
      subtle: "rgba(255, 255, 255, 0.18)",
      strong: "rgba(255, 255, 255, 0.32)",
      focus: "rgba(var(--brand-rgb), 1)",
    },
  },
  /* Ombres franches, portées plus loin et plus denses. Une ombre douce ne se
   * voit pas de loin ; ce qui se voit, c'est le décollement — et c'est lui qui
   * dit quelle carte porte le focus. */
  shadow: {
    elev1: "0 6px 18px rgba(0, 0, 0, 0.6)",
    elev2: "0 12px 36px rgba(0, 0, 0, 0.72)",
    elev3: "0 24px 64px rgba(0, 0, 0, 0.85)",
  },
  /* Rayons agrandis proportionnellement aux surfaces : un rayon de 4 px sur une
   * carte de 300 px de large ne se lit pas comme un arrondi mais comme un
   * défaut. `pill` garde sa valeur du socle — un demi-cercle reste un
   * demi-cercle quelle que soit la distance. */
  radius: {
    xs: "6px",
    sm: "10px",
    md: "14px",
    lg: "20px",
    xl: "26px",
  },
};

/**
 * Le thème clair du téléviseur.
 *
 * Il reste possible — certains préfèrent une dalle moins sombre en plein jour —
 * mais ses surfaces doivent être opaques pour les mêmes raisons que ci-dessus.
 * webOS le fige en sombre (`shims/darkTheme.ts`) ; les cibles natives peuvent
 * s'en servir.
 */
export const TV_THEME_TOKEN_OVERRIDES_LIGHT: PartialThemeTokens = {
  color: {
    glass: {
      tint: "#ffffff",
      tintStrong: "#f4f4f7",
      panel: "#ffffff",
      backdrop: "rgba(0, 0, 0, 0.5)",
    },
    surface: {
      modal: "#ffffff",
      dropdown: "#ffffff",
      sheet: "#ffffff",
      toolbar: "#f4f4f7",
    },
    border: {
      subtle: "rgba(0, 0, 0, 0.16)",
      strong: "rgba(0, 0, 0, 0.3)",
    },
  },
};
