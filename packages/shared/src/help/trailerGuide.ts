/**
 * Le guide « Bandes-annonces » : pourquoi une fiche n'en montre pas, et ce que
 * chacun peut y faire. UNE seule source pour toutes les plateformes — la
 * STRUCTURE ici (parties, étapes, liens), les MOTS dans l'espace i18n
 * `trailerHelp`. Le web, le bureau, le miroir et le mobile rendent ce modèle
 * tel quel ; les téléviseurs n'en gardent qu'une phrase qui renvoie vers eux
 * (on ne lit pas un guide à la télécommande).
 *
 * Deux parties : « Pour tous » (ce n'est pas vous, d'où elles viennent, qui
 * peut agir) et « Pour l'administrateur » (les étapes précises, dans Jellyfin
 * puis dans Tentacle). Les liens vers le tableau de bord de Jellyfin et vers
 * l'administration de Tentacle ne s'ouvrent qu'à un administrateur : pour les
 * autres, ce seraient des portes fermées.
 */

/** L'adresse du guide dans les clients — la même sur le web, le bureau, le miroir et le mobile. */
export const TRAILER_GUIDE_PATH = "/help/trailers";

/** Les deux parties du guide, qui sont aussi ses ancres (`/help/trailers#admin`). */
export type TrailerGuidePart = "everyone" | "admin";

export const TRAILER_GUIDE_PARTS: readonly TrailerGuidePart[] = ["everyone", "admin"];

/** L'adresse d'une partie du guide — pour un lien direct (la vue d'ensemble de l'administration vise `admin`). */
export function trailerGuideHref(part?: TrailerGuidePart): string {
  return part ? `${TRAILER_GUIDE_PATH}#${part}` : TRAILER_GUIDE_PATH;
}

/**
 * Les pages du tableau de bord de Jellyfin, à partir de sa racine — les mêmes
 * de 10.10 à 12.x (relevées dans jellyfin-web ; ce sont aussi celles des
 * réglages recommandés de l'administration, `DASHBOARD` côté serveur).
 */
export const JELLYFIN_DASHBOARD_PAGES = {
  libraries: "/web/#/dashboard/libraries",
  plugins: "/web/#/dashboard/plugins",
} as const;

export type JellyfinDashboardPage = keyof typeof JELLYFIN_DASHBOARD_PAGES;

/** Les pages de l'administration de Tentacle (web) vers lesquelles le guide renvoie. */
export const TENTACLE_ADMIN_PAGES = {
  overview: "/admin",
  plugins: "/admin/plugins",
  services: "/admin/services",
} as const;

export type TentacleAdminPage = keyof typeof TENTACLE_ADMIN_PAGES;

/** La documentation officielle de Jellyfin sur les extras d'un film (bandes-annonces comprises). */
export const JELLYFIN_EXTRAS_DOC_URL = "https://jellyfin.org/docs/general/server/media/movies#extras";

export type TrailerGuideLink =
  | { kind: "jellyfin"; page: JellyfinDashboardPage; labelKey: string }
  | { kind: "admin"; page: TentacleAdminPage; labelKey: string }
  | { kind: "docs"; url: string; labelKey: string };

export type TrailerGuideStepId = "tmdb" | "refresh" | "localFiles" | "jellyseerr" | "update";

export interface TrailerGuideStep {
  id: TrailerGuideStepId;
  titleKey: string;
  /** Les paragraphes, dans l'ordre ; l'exemple s'insère après le premier. */
  paragraphKeys: readonly string[];
  /** Une arborescence d'exemple (une ligne par fichier), rendue en police à chasse fixe. */
  exampleKey: string | null;
  /** Les deux premières étapes suffisent le plus souvent ; les autres complètent. */
  optional: boolean;
  links: readonly TrailerGuideLink[];
}

const LIBRARIES_LINK: TrailerGuideLink = { kind: "jellyfin", page: "libraries", labelKey: "linkJellyfinLibraries" };

/** Pour l'administrateur : les étapes, dans l'ordre où les faire. */
export const TRAILER_GUIDE_STEPS: readonly TrailerGuideStep[] = [
  {
    id: "tmdb",
    titleKey: "stepTmdbTitle",
    paragraphKeys: ["stepTmdbLibraries", "stepTmdbPlugin"],
    exampleKey: null,
    optional: false,
    links: [LIBRARIES_LINK, { kind: "jellyfin", page: "plugins", labelKey: "linkJellyfinPlugins" }],
  },
  {
    id: "refresh",
    titleKey: "stepRefreshTitle",
    paragraphKeys: ["stepRefreshHow", "stepRefreshTentacle"],
    exampleKey: null,
    optional: false,
    links: [LIBRARIES_LINK, { kind: "admin", page: "overview", labelKey: "linkAdminOverview" }],
  },
  {
    id: "localFiles",
    titleKey: "stepLocalTitle",
    paragraphKeys: ["stepLocalHow", "stepLocalSeries"],
    exampleKey: "stepLocalExample",
    optional: true,
    links: [{ kind: "docs", url: JELLYFIN_EXTRAS_DOC_URL, labelKey: "linkJellyfinDocs" }],
  },
  {
    id: "jellyseerr",
    titleKey: "stepJellyseerrTitle",
    paragraphKeys: ["stepJellyseerrBody"],
    exampleKey: null,
    optional: true,
    links: [{ kind: "admin", page: "plugins", labelKey: "linkAdminPlugins" }],
  },
  {
    id: "update",
    titleKey: "stepUpdateTitle",
    paragraphKeys: ["stepUpdateJellyfin12", "stepUpdateAppleTv"],
    exampleKey: null,
    optional: false,
    links: [{ kind: "admin", page: "services", labelKey: "linkAdminServices" }],
  },
];

export interface TrailerGuideSource {
  id: "local" | "remote";
  titleKey: string;
  bodyKey: string;
}

/** Pour tous : les deux sources d'une bande-annonce, dans l'ordre où Tentacle les essaie. */
export const TRAILER_GUIDE_SOURCES: readonly TrailerGuideSource[] = [
  { id: "local", titleKey: "sourceLocalTitle", bodyKey: "sourceLocalBody" },
  { id: "remote", titleKey: "sourceRemoteTitle", bodyKey: "sourceRemoteBody" },
];

/** Pour tous : « Bon à savoir ». */
export const TRAILER_GUIDE_NOTES: readonly string[] = ["noteRare", "notePhone", "noteAppleTv"];

/** Ce qu'une plateforme sait ouvrir. */
export interface TrailerGuideLinkContext {
  isAdmin: boolean;
  /**
   * La racine du tableau de bord de Jellyfin pour le navigateur de
   * l'administrateur (adresse publique, sinon interne), sans barre finale ;
   * `null` tant qu'elle n'est pas connue.
   */
  jellyfinUrl: string | null;
  /**
   * Où vit l'administration de Tentacle : `"app"` quand elle est DANS
   * l'application (web, bureau, miroir — route interne), une origine web
   * quand il faut l'ouvrir dans le navigateur (mobile), `null` si nulle part.
   */
  adminOrigin: "app" | string | null;
}

export interface ResolvedGuideLink {
  href: string;
  /** Hors de l'application : nouvel onglet ou navigateur du système. */
  external: boolean;
}

/**
 * L'adresse d'un lien du guide pour CETTE plateforme et CE compte, ou `null`
 * quand il ne mènerait nulle part : un tableau de bord de Jellyfin ou une
 * administration de Tentacle ne s'ouvrent qu'à un administrateur, et
 * seulement quand on sait où ils sont.
 */
export function resolveGuideLink(link: TrailerGuideLink, ctx: TrailerGuideLinkContext): ResolvedGuideLink | null {
  switch (link.kind) {
    case "docs":
      return { href: link.url, external: true };
    case "jellyfin": {
      if (!ctx.isAdmin || !ctx.jellyfinUrl) return null;
      return { href: `${ctx.jellyfinUrl.replace(/\/+$/, "")}${JELLYFIN_DASHBOARD_PAGES[link.page]}`, external: true };
    }
    case "admin": {
      if (!ctx.isAdmin || !ctx.adminOrigin) return null;
      const route = TENTACLE_ADMIN_PAGES[link.page];
      if (ctx.adminOrigin === "app") return { href: route, external: false };
      return { href: `${ctx.adminOrigin.replace(/\/+$/, "")}${route}`, external: true };
    }
  }
}

/** Toutes les clés i18n que le modèle référence — le test vérifie qu'elles existent dans les deux langues. */
export function trailerGuideKeys(): string[] {
  const keys = new Set<string>(TRAILER_GUIDE_NOTES);
  for (const source of TRAILER_GUIDE_SOURCES) keys.add(source.titleKey).add(source.bodyKey);
  for (const step of TRAILER_GUIDE_STEPS) {
    keys.add(step.titleKey);
    for (const key of step.paragraphKeys) keys.add(key);
    if (step.exampleKey) keys.add(step.exampleKey);
    for (const link of step.links) keys.add(link.labelKey);
  }
  return [...keys];
}
