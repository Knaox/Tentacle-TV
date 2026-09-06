/**
 * Le faux Jellyfin des tests de `/api/downloads` : policies par jeton,
 * ancêtres, `/Download` avec Range, `/stream.mp4` dont l'URL est capturée.
 * Partagé par `downloads.test.ts` et `downloadsRemux.test.ts`.
 */

export const LIB_A_DASHED = "1111aaaa-bbbb-cccc-dddd-eeeeffff0000";
export const LIB_A_PLAIN = "1111aaaabbbbccccddddeeeeffff0000";
export const LIB_B_PLAIN = "2222aaaabbbbccccddddeeeeffff0000";
export const ITEM_IN_A = "a".repeat(32);
export const ITEM_IN_B = "b".repeat(32);

export interface FakePolicy {
  EnableContentDownloading: boolean;
  EnableMediaConversion: boolean;
  EnableVideoPlaybackTranscoding: boolean;
  EnableAudioPlaybackTranscoding: boolean;
  EnablePlaybackRemuxing: boolean;
  EnableAllFolders: boolean;
  EnabledFolders: string[];
  BlockedMediaFolders: string[] | null;
}

const basePolicy: FakePolicy = {
  EnableContentDownloading: true,
  EnableMediaConversion: true,
  EnableVideoPlaybackTranscoding: true,
  EnableAudioPlaybackTranscoding: true,
  EnablePlaybackRemuxing: true,
  EnableAllFolders: true,
  EnabledFolders: [],
  BlockedMediaFolders: null,
};

export const POLICIES: Record<string, FakePolicy> = {
  "tok-full": { ...basePolicy },
  "tok-nodl": { ...basePolicy, EnableContentDownloading: false },
  "tok-noconv": { ...basePolicy, EnableMediaConversion: false },
  "tok-scoped": {
    ...basePolicy,
    EnableAllFolders: false,
    // Forme AVEC tirets côté policy, SANS tirets côté ancêtres → doit matcher.
    EnabledFolders: [LIB_A_DASHED],
  },
  "tok-blocked": { ...basePolicy, BlockedMediaFolders: [LIB_A_PLAIN] },
};

function tokenFromHeaders(headers: Headers): string | null {
  const emby = headers.get("x-emby-token");
  if (emby) return emby;
  const auth = headers.get("authorization") ?? "";
  const match = auth.match(/Token="([^"]+)"/);
  return match ? match[1] : null;
}

/** Dernière URL de stream Allégé reçue par le faux Jellyfin (assertions). */
export const streamCapture = { lastUrl: "" };

export function fakeJellyfin(input: RequestInfo | URL, init?: RequestInit): Response {
  const url = String(input);
  const headers = new Headers(init?.headers);
  const token = tokenFromHeaders(headers);
  const policy = token ? POLICIES[token] : undefined;

  if (url.includes("/stream.mp4")) {
    if (!policy) return new Response("", { status: 401 });
    streamCapture.lastUrl = url;
    return new Response("LIGHTDATA", {
      status: 200,
      headers: { "content-type": "video/mp4" },
    });
  }

  if (url.includes("/Users/Me")) {
    if (!policy) return new Response("", { status: 401 });
    return Response.json({ Id: `user-${token}`, Name: token, Policy: policy });
  }

  if (url.includes("/Ancestors")) {
    if (!policy) return new Response("", { status: 401 });
    const lib = url.includes(ITEM_IN_A) ? LIB_A_PLAIN : LIB_B_PLAIN;
    return Response.json([
      { Id: "season-1", Type: "Season" },
      { Id: "series-1", Type: "Series" },
      { Id: lib, Type: "CollectionFolder" },
    ]);
  }

  if (url.includes("/Download")) {
    if (!policy?.EnableContentDownloading) return new Response("", { status: 403 });
    const range = headers.get("range");
    if (range) {
      return new Response("KEDA", {
        status: 206,
        headers: {
          "content-type": "video/x-matroska",
          "content-length": "4",
          "content-range": "bytes 2-5/8",
          "accept-ranges": "bytes",
        },
      });
    }
    return new Response("FAKEDATA", {
      status: 200,
      headers: {
        "content-type": "video/x-matroska",
        "content-length": "8",
        "accept-ranges": "bytes",
        "content-disposition": 'attachment; filename="film.mkv"',
      },
    });
  }

  return new Response("", { status: 404 });
}
