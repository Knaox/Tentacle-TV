import { recoRowTitle } from "@tentacle-tv/api-client";

type Translate = (key: string, opts?: Record<string, unknown>) => string;

interface LabelContext {
  /** `useTranslation("common")` */
  tCommon: Translate;
  /** `useTranslation("reco")` */
  tReco: Translate;
  librariesById: ReadonlyMap<string, string>;
}

/**
 * Le libellé d'une rangée de l'accueil dans l'éditeur — le miroir de
 * `labelFor` de la page Personnalisation du web : mêmes clés, mêmes titres
 * que les rangées elles-mêmes (tendances, pouls, mieux notés compris).
 */
export function homeRowLabel(key: string, ctx: LabelContext): string {
  if (key === "resume") return ctx.tCommon("resumeWatching");
  if (key === "nextUp") return ctx.tCommon("nextEpisodes");
  if (key === "watchlist") return ctx.tCommon("myList");
  if (key === "watched") return ctx.tCommon("alreadyWatched");
  if (key === "favorites") return ctx.tCommon("myFavorites");
  if (key.startsWith("library:")) {
    return ctx.tCommon("latestAdditions", { name: ctx.librariesById.get(key.slice("library:".length)) ?? "?" });
  }
  if (key.startsWith("reco:")) return ctx.tReco(recoRowTitle({ key: key.slice("reco:".length) }).key);
  return key;
}
