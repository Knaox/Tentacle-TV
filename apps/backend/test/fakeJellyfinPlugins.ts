/**
 * Un Jellyfin en mémoire pour les greffons de passages : dépôts, catalogue,
 * installation, redémarrage, configuration des greffons, tâches planifiées —
 * les formes relevées sur 10.11.11 et 12.1.0. Il répond à la place de
 * `jellyfinAdminFetch` (mocké) et de `fetch` (sonde publique, manifestes).
 */

type Loose = Record<string, unknown>;

export interface FakePluginSeed {
  guid: string;
  name: string;
  repo: string;
  /** Versions proposées à ce Jellyfin (vide : aucune compatible). */
  versions: string[];
  config: Loose;
}

export const SEEDS: Record<string, FakePluginSeed> = {
  introSkipper: {
    guid: "c83d86bba1e04c35a113e2101cf4ee6b",
    name: "Intro Skipper",
    repo: "https://intro-skipper.org/manifest.json",
    versions: ["12.0.4.0"],
    config: { AutoDetectIntros: true, PreferChromaprint: false, ScanIntroduction: true },
  },
  theIntroDb: {
    guid: "c9e41b9563e445e29db6b83df21ae5e7",
    name: "TheIntroDB",
    repo: "https://raw.githubusercontent.com/TheIntroDB/jellyfin-plugin/main/manifest.json",
    versions: ["1.1.3.0"],
    config: { ApiKey: "", EnableIntro: true, EnableRecap: true, EnableCredits: true, EnablePreview: true, EnableOnDemandFetch: true },
  },
  skipMeDb: {
    guid: "b2a63e620ac545759ad22c7534ccb83d",
    name: "SkipMe.db",
    repo: "https://intro-skipper.org/manifest.json",
    versions: ["0.2.5.0"],
    config: { DisabledSeriesIds: [] },
  },
};

const TASK_OF: Record<string, { Key: string; Triggers: unknown[] }> = {
  introSkipper: { Key: "IntroSkipperDetectSegmentsTask", Triggers: [{ Type: "DailyTrigger" }] },
  skipMeDb: { Key: "SkipMeDaily", Triggers: [{ Type: "DailyTrigger" }] },
};

export class FakeJellyfin {
  version = "12.1.0";
  repositories: Loose[] = [{ Name: "Jellyfin Stable", Url: "https://repo.jellyfin.org/files/plugin/manifest.json", Enabled: true }];
  plugins: Loose[] = [];
  configs = new Map<string, Loose>();
  tasks: Loose[] = [{ Id: "t-seg", Key: "TaskExtractMediaSegments", Triggers: [{ Type: "IntervalTrigger" }] }];
  /** Dépôts qui ne répondent pas (ni à Jellyfin, ni à la sonde). */
  offline = new Set<string>();
  playing = false;
  pendingRestart = false;
  /** Nombre de sondes publiques pendant lesquelles il reste « tombé » après un redémarrage. */
  downFor = 0;
  restarts = 0;
  refuseRestart = false;
  calls: string[] = [];
  seeds: Record<string, FakePluginSeed> = structuredClone(SEEDS);

  /** Un greffon déjà là (avant le passage). */
  preinstall(key: string, status = "Active", config?: Loose): void {
    const seed = this.seeds[key];
    this.plugins.push({ Id: seed.guid, Name: seed.name, Version: seed.versions[0] ?? "1.0.0.0", Status: status });
    this.configs.set(seed.guid, structuredClone(config ?? seed.config));
    const task = TASK_OF[key];
    if (task) this.tasks.push({ Id: `t-${key}`, ...structuredClone(task) });
  }

  private repoKnown(url: string): boolean {
    return this.repositories.some((repo) => repo.Url === url && repo.Enabled !== false);
  }

  async admin(path: string, options: { method?: string; body?: unknown } = {}): Promise<{ ok: true; data: unknown } | { ok: false; failure: string }> {
    const method = options.method ?? "GET";
    this.calls.push(`${method} ${path}`);
    const ok = (data: unknown = null) => ({ ok: true as const, data });
    if (this.downFor > 0) return { ok: false, failure: "unreachable" };
    if (path === "/System/Info/Public") return ok({ Version: this.version, Id: "srv" });
    if (path === "/System/Info") return ok({ Version: this.version, HasPendingRestart: this.pendingRestart });
    if (path === "/Plugins") return ok(structuredClone(this.plugins));
    if (path === "/Repositories" && method === "GET") return ok(structuredClone(this.repositories));
    if (path === "/Repositories") {
      this.repositories = structuredClone(options.body as Loose[]);
      return ok();
    }
    if (path === "/Packages") {
      return ok(Object.values(this.seeds)
        .filter((seed) => this.repoKnown(seed.repo) && !this.offline.has(seed.repo) && seed.versions.length > 0)
        .map((seed) => ({ name: seed.name, guid: seed.guid, versions: seed.versions.map((version) => ({ version, repositoryUrl: seed.repo })) })));
    }
    const install = path.match(/^\/Packages\/Installed\/([^?]+)\?assemblyGuid=(\w+)/);
    if (install && method === "POST") {
      const [key] = Object.entries(this.seeds).find(([, seed]) => seed.guid === install[2]) ?? [];
      if (!key) return { ok: false, failure: "invalid" };
      this.preinstall(key, "Restart");
      this.pendingRestart = true;
      return ok();
    }
    const enable = path.match(/^\/Plugins\/(\w+)\/[^/]+\/Enable$/);
    if (enable) {
      const plugin = this.plugins.find((entry) => entry.Id === enable[1]);
      if (plugin) plugin.Status = "Restart";
      this.pendingRestart = true;
      return ok();
    }
    if (path.startsWith("/Sessions")) return ok(this.playing ? [{ Id: "s", NowPlayingItem: { Id: "x" } }] : [{ Id: "s" }]);
    if (path === "/System/Restart") {
      if (this.refuseRestart) return { ok: false, failure: "rejected" };
      this.restarts += 1;
      this.downFor = 2;
      for (const plugin of this.plugins) if (plugin.Status === "Restart") plugin.Status = "Active";
      this.pendingRestart = false;
      return ok();
    }
    const config = path.match(/^\/Plugins\/(\w+)\/Configuration$/);
    if (config) {
      const plugin = this.plugins.find((entry) => entry.Id === config[1]);
      if (!plugin || plugin.Status !== "Active") return { ok: false, failure: "invalid" };
      if (method === "POST") this.configs.set(config[1], structuredClone(options.body as Loose));
      return ok(structuredClone(this.configs.get(config[1])));
    }
    if (path.startsWith("/ScheduledTasks?")) {
      const loaded = new Set(this.plugins.filter((p) => p.Status === "Active").map((p) => p.Name));
      return ok(structuredClone(this.tasks.filter((task) => {
        if (task.Key === "IntroSkipperDetectSegmentsTask") return loaded.has("Intro Skipper");
        if (String(task.Key).startsWith("SkipMe")) return loaded.has("SkipMe.db");
        return true;
      })));
    }
    const triggers = path.match(/^\/ScheduledTasks\/([^/]+)\/Triggers$/);
    if (triggers) {
      const task = this.tasks.find((entry) => entry.Id === decodeURIComponent(triggers[1]));
      if (task) task.Triggers = structuredClone(options.body as unknown[]);
      return ok();
    }
    return { ok: false, failure: "invalid" };
  }

  /** `fetch` : la sonde publique (qui fait « tomber » puis revenir) et les manifestes. */
  async fetch(url: string): Promise<Response> {
    if (url.endsWith("/System/Info/Public")) {
      if (this.downFor > 0) {
        this.downFor -= 1;
        return new Response("", { status: 503 });
      }
      return Response.json({ Version: this.version, Id: "srv" });
    }
    const seed = Object.values(this.seeds).find((candidate) => candidate.repo === url);
    if (!seed || this.offline.has(url)) return new Response("", { status: 502 });
    return Response.json(Object.values(this.seeds).filter((s) => s.repo === url).map((s) => ({ guid: s.guid, name: s.name, versions: [] })));
  }
}
