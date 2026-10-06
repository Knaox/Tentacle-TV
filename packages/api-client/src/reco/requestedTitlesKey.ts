/**
 * Les titres que le compte a demandés (`GET /api/reco/requested`) : un
 * tableau de clés (« movie:603 »). Sous « reco » : `invalidateRecoQueries`
 * le relit avec le reste. À part (sans dépendance) pour que la règle du
 * lâcher (recoRetirement.ts) le lise sans cycle d'import.
 */
export const REQUESTED_TITLES_KEY = ["reco", "requested"] as const;
