/**
 * Ce que le contrôle parental lit chez Jellyfin en plus des comptes (la table des
 * notes, les bibliothèques, les canaux, les étiquettes), par-dessus le faux
 * Jellyfin de la Famille. Une table réduite : 0, 6, 10, 12, 16, 18.
 */

type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const RATINGS = [0, 6, 10, 12, 16, 18].map((score) => ({ Name: String(score), RatingScore: { score, subScore: null } }));

export function withParentalOptions(base: Fetch): Fetch {
  return async (input, init) => {
    const path = new URL(String(input)).pathname;
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (path === "/Localization/ParentalRatings") return json(RATINGS);
    if (path === "/Library/VirtualFolders") return json([]);
    if (path === "/Channels") return json({ Items: [] });
    if (path === "/Items/Filters") return json({ Tags: [] });
    return base(input, init);
  };
}
