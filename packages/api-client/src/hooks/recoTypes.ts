/**
 * Les types du moteur de recommandation partagés par les hooks (page, rangées
 * de compat, notes, feedback). Déplacés hors de useRecoRows pour que
 * useRecoPage et les mutations ne s'importent pas en cycle.
 *
 * La source est le CONTRAT de `/api/reco/page` (shared, reco/recoPageTypes) :
 * mêmes noms, sur-ensembles — `why` (raisons structurées), `match`
 * (correspondance), tout en optionnel. Un serveur qui ne les envoie pas laisse
 * le client tel qu'avant.
 */
export type {
  RecoState,
  RecoReason,
  RecoProviderRef,
  RecoRowItem,
  RecoWhy,
  RecoWhyKind,
  RecoTitleRef,
  RecoPersonRef,
  RecoCreditRole,
  RecoThemeRef,
  RecoThemeTag,
  RecoFeatured,
} from "@tentacle-tv/shared";
