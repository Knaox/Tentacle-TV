export interface MpvTrack {
  id: number;
  type: "video" | "audio" | "sub";
  lang?: string;
  title?: string;
  codec?: string;
  selected: boolean;
}

type PluginApi = typeof import("tauri-plugin-libmpv-api");

/** Safe property fetch — returns null on error (property unavailable). */
const safeProp = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

/** Query mpv's full track list after file-loaded. */
export async function queryTrackList(mpv: PluginApi): Promise<MpvTrack[]> {
  const count = await safeProp(mpv.getProperty("track-list/count", "int64"));
  if (!count || count <= 0) return [];
  const tracks: MpvTrack[] = [];
  for (let i = 0; i < count; i++) {
    // id and type are required — fetch them first
    const [id, type] = await Promise.all([
      safeProp(mpv.getProperty(`track-list/${i}/id`, "int64")),
      safeProp(mpv.getProperty(`track-list/${i}/type`, "string")),
    ]);
    if (id == null || type == null) continue;
    // Optional properties — fetch in parallel, all fault-tolerant
    const [lang, title, codec, selected] = await Promise.all([
      safeProp(mpv.getProperty(`track-list/${i}/lang`, "string")),
      safeProp(mpv.getProperty(`track-list/${i}/title`, "string")),
      safeProp(mpv.getProperty(`track-list/${i}/codec`, "string")),
      safeProp(mpv.getProperty(`track-list/${i}/selected`, "flag")),
    ]);
    tracks.push({
      id: id as number,
      type: type as MpvTrack["type"],
      lang: (lang as string | null) ?? undefined,
      title: (title as string | null) ?? undefined,
      codec: (codec as string | null) ?? undefined,
      selected: (selected as boolean | null) ?? false,
    });
  }
  console.debug("[mpv] queryTrackList result:", tracks.map(t => ({ id: t.id, type: t.type, lang: t.lang, selected: t.selected })));
  return tracks;
}
