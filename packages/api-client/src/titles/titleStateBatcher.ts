import { TITLE_STATE_BATCH, readTitleStates, titleStateUrl, type TitleState } from "@tentacle-tv/shared";
import { createTitleBatcher } from "./titleKeyBatcher";

/**
 * Une rangée monte vingt cartes hors bibliothèque d'un coup, et chacune veut
 * savoir où en est SON titre. Une requête par carte ferait vingt allers-retours
 * vers le plugin ; ce regroupeur les rassemble : les clés demandées dans la
 * même fenêtre (une image, ~16 ms) partent ensemble, par paquets de
 * `TITLE_STATE_BATCH`. Chaque carte garde son entrée de cache à elle (cf.
 * `useTitleState`) : une demande faite ne re-rend que sa carte.
 */

export type { TitleFetcher } from "./titleKeyBatcher";

/** L'état d'UN titre, regroupé avec ceux que les autres cartes demandent au même instant. */
export const loadTitleState = createTitleBatcher<TitleState | null>({
  id: (provider, lang) => `${provider.pluginId}|${provider.statePath}|${lang}`,
  url: titleStateUrl,
  read: readTitleStates,
  // Une clé que le plugin ne connaît pas : rien à dire, rien à offrir.
  missing: null,
  batch: TITLE_STATE_BATCH,
});
