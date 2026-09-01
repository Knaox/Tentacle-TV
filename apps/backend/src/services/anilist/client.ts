/**
 * AniList — endpoint GraphQL unique, tout en POST. Les lectures publiques se
 * passent de jeton ; les mutations exigent l'OAuth2 de l'utilisateur.
 */

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

export class AniListError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AniListError";
    this.status = status;
  }
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string; status?: number }>;
}

export async function anilistQuery<T>(
  query: string,
  variables: Record<string, unknown>,
  accessToken?: string
): Promise<T> {
  const res = await fetch(ANILIST_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as GraphQLResponse<T> | null;
  if (!res.ok || !body?.data) {
    const message = body?.errors?.[0]?.message ?? `AniList ${res.status}`;
    throw new AniListError(message, body?.errors?.[0]?.status ?? res.status);
  }
  return body.data;
}

/** Le compte lié (id + pseudo) — vérifie aussi que le jeton vit encore. */
export async function fetchViewer(accessToken: string): Promise<{ id: number; name: string }> {
  const data = await anilistQuery<{ Viewer: { id: number; name: string } }>(
    "query { Viewer { id name } }",
    {},
    accessToken
  );
  return data.Viewer;
}

/** Pousse une note (échelle interne 1..10 → POINT_10_DECIMAL directement). */
export async function pushAnilistScore(
  accessToken: string,
  anilistId: number,
  score: number
): Promise<void> {
  await anilistQuery(
    `mutation ($mediaId: Int!, $score: Float) {
      SaveMediaListEntry(mediaId: $mediaId, score: $score) { id }
    }`,
    { mediaId: anilistId, score },
    accessToken
  );
}

/** Efface l'entrée de liste (si elle existe encore). */
export async function deleteAnilistScore(accessToken: string, anilistId: number): Promise<void> {
  const data = await anilistQuery<{
    Media: { mediaListEntry: { id: number } | null } | null;
  }>(
    `query ($mediaId: Int!) { Media(id: $mediaId) { mediaListEntry { id } } }`,
    { mediaId: anilistId },
    accessToken
  ).catch(() => null);
  const entryId = data?.Media?.mediaListEntry?.id;
  if (!entryId) return;
  await anilistQuery(
    "mutation ($id: Int!) { DeleteMediaListEntry(id: $id) { deleted } }",
    { id: entryId },
    accessToken
  );
}

/** Recherche de repli : titre romaji + année → id du meilleur candidat. */
export async function searchAnime(
  title: string,
  year: number | null,
  format: "TV" | "MOVIE"
): Promise<number | null> {
  const data = await anilistQuery<{
    Page: { media: Array<{ id: number; startDate?: { year?: number } }> };
  }>(
    `query ($search: String!, $format: [MediaFormat]) {
      Page(perPage: 5) {
        media(search: $search, type: ANIME, format_in: $format, sort: SEARCH_MATCH) {
          id
          startDate { year }
        }
      }
    }`,
    {
      search: title,
      format: format === "MOVIE" ? ["MOVIE"] : ["TV", "TV_SHORT", "ONA", "OVA"],
    }
  ).catch(() => null);
  const media = data?.Page.media ?? [];
  if (media.length === 0) return null;
  if (year != null) {
    const sameYear = media.find((m) => m.startDate?.year != null && Math.abs(m.startDate.year - year) <= 1);
    if (sameYear) return sameYear.id;
  }
  return media[0].id;
}
