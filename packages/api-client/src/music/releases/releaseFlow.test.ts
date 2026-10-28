import { describe, expect, it } from "vitest";
import { RELEASE_CHUNK_BYTES, type MusicAlbum, type ReleaseImportJob } from "@tentacle-tv/shared/music";
import { TentacleApiError } from "../../hooks/usePreferences";
import { runReleaseFiles, runReleaseLink, type ReleaseFlowState, type ReleaseLocalFile, type ReleasePort } from "./releaseFlow";

const album = { key: "ext:sillon:own:a1", title: "Édition spéciale", imported: true } as unknown as MusicAlbum;

function file(name: string, size: number): ReleaseLocalFile {
  return { name, size, type: "audio/flac", read: async (start, end) => `${name}:${start}-${end}` };
}

/** Un faux serveur : il reçoit les morceaux à leur place, et lit le lot en deux questions. */
function fakeServer(options: { failAt?: number; failTimes?: number; refuse?: string; linkJob?: ReleaseImportJob } = {}) {
  const received = new Map<string, number>();
  const puts: string[] = [];
  let polls = 0;
  let failures = 0;
  let job: ReleaseImportJob = { jobId: "j1", source: "files", state: "receiving", files: [], albums: [] };
  const port: ReleasePort = {
    startLink: async () => options.linkJob ?? { jobId: "l1", source: "bandcamp", state: "reading", albums: [] },
    startFiles: async (files) => {
      job = { ...job, files: files.map((f, i) => ({ uploadId: `u${i}`, name: f.name, size: f.size, received: 0, state: "waiting" })) };
      return job;
    },
    putChunk: async (uploadId, offset, body) => {
      if (uploadId === options.refuse) throw new TentacleApiError('{"error":"unreadable"}', 415);
      if (options.failAt === offset && failures < (options.failTimes ?? 0)) {
        failures++;
        throw new TentacleApiError("", 0);
      }
      expect(received.get(uploadId) ?? 0).toBe(offset);
      puts.push(String(body));
      const size = job.files!.find((f) => f.uploadId === uploadId)!.size;
      const next = Math.min(size, offset + RELEASE_CHUNK_BYTES);
      received.set(uploadId, next);
      return next;
    },
    uploaded: async (uploadId) => received.get(uploadId) ?? 0,
    job: async (jobId) => {
      polls++;
      return polls < 2 ? { ...job, jobId, state: "reading" } : { ...job, jobId, state: "done", albums: [album] };
    },
    sleep: async () => undefined,
  };
  return { port, puts, received };
}

const collect = () => {
  const states: ReleaseFlowState[] = [];
  return { states, emit: (s: ReleaseFlowState) => states.push(s) };
};

describe("import de fichiers", () => {
  it("envoie chaque fichier par morceaux, à sa place, puis rend l'album", async () => {
    const server = fakeServer();
    const { states, emit } = collect();
    const big = RELEASE_CHUNK_BYTES * 2 + 5;
    const final = await runReleaseFiles(server.port, [file("1.flac", big), file("2.mp3", 10)], emit, new AbortController().signal);
    expect(server.puts).toEqual([`1.flac:0-${RELEASE_CHUNK_BYTES}`, `1.flac:${RELEASE_CHUNK_BYTES}-${RELEASE_CHUNK_BYTES * 2}`, `1.flac:${RELEASE_CHUNK_BYTES * 2}-${big}`, "2.mp3:0-10"]);
    expect(final.phase).toBe("done");
    expect(final.job?.albums).toEqual([album]);
    expect(states.some((s) => s.phase === "reading")).toBe(true);
    // L'avancement ne recule jamais.
    const sent = states.map((s) => s.sentBytes);
    expect(sent).toEqual([...sent].sort((a, b) => a - b));
  });

  it("une coupure brève se réessaie seule", async () => {
    const server = fakeServer({ failAt: 0, failTimes: 2 });
    const final = await runReleaseFiles(server.port, [file("1.mp3", 10)], () => undefined, new AbortController().signal);
    expect(final.phase).toBe("done");
  });

  it("une coupure qui dure met en pause, et « Reprendre » ne renvoie pas ce qui est reçu", async () => {
    const big = RELEASE_CHUNK_BYTES + 3;
    const server = fakeServer({ failAt: RELEASE_CHUNK_BYTES, failTimes: 4 });
    const files = [file("1.flac", big)];
    const paused = await runReleaseFiles(server.port, files, () => undefined, new AbortController().signal);
    expect(paused.phase).toBe("paused");
    expect(server.received.get("u0")).toBe(RELEASE_CHUNK_BYTES);
    server.puts.length = 0;
    const final = await runReleaseFiles(server.port, files, () => undefined, new AbortController().signal, paused.job!);
    expect(server.puts).toEqual([`1.flac:${RELEASE_CHUNK_BYTES}-${big}`]);
    expect(final.phase).toBe("done");
  });

  it("un fichier refusé n'arrête pas les autres", async () => {
    const server = fakeServer({ refuse: "u0" });
    const { states, emit } = collect();
    const final = await runReleaseFiles(server.port, [file("x.wav", 10), file("2.mp3", 10)], emit, new AbortController().signal);
    expect(server.puts).toEqual(["2.mp3:0-10"]);
    expect(states.some((s) => s.job?.files?.[0].state === "refused" && s.job.files[0].refusal === "unreadable")).toBe(true);
    expect(final.phase).toBe("done");
  });
});

describe("import d'un lien", () => {
  it("suit le job jusqu'à l'album", async () => {
    const server = fakeServer();
    const final = await runReleaseLink(server.port, "https://a.bandcamp.com/album/x", () => undefined, new AbortController().signal);
    expect(final.phase).toBe("done");
    expect(final.source).toBe("bandcamp");
  });

  it("un refus garde son code", async () => {
    const port = { ...fakeServer().port, startLink: async () => { throw new TentacleApiError('{"error":"notFound"}', 404); } };
    const final = await runReleaseLink(port, "https://a.bandcamp.com/album/x", () => undefined, new AbortController().signal);
    expect(final).toMatchObject({ phase: "failed", refusal: "notFound" });
  });

  it("un job fini sans album est un échec", async () => {
    const server = fakeServer({ linkJob: { jobId: "l", source: "bandcamp", state: "done", albums: [] } });
    const final = await runReleaseLink(server.port, "https://a.bandcamp.com/album/x", () => undefined, new AbortController().signal);
    expect(final.phase).toBe("failed");
  });
});
