import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { deleteConfigValue, getDirectStreamingConfig, getPublicUrl, setConfigValue } from "../services/configStore";
import { originOf } from "../services/jellyfinCors";
import { requestPageOrigin, syncJellyfinCors } from "../services/jellyfinCorsSync";

/**
 * La lecture directe (`/api/admin/direct-streaming`, sous `requireAdmin`) :
 * les applications lisent chez Jellyfin sans passer par Tentacle. L'adresse
 * PRIVÉE (réseau local) suffit à l'allumer ; la PUBLIQUE est facultative —
 * sans elle, hors de la maison, la lecture passe par Tentacle. Les mêmes
 * règles que l'étape « Accès à distance » de l'assistant.
 *
 * Les `CorsHosts` de Jellyfin suivent seuls (`jellyfinCorsSync.ts`) : à
 * l'enregistrement et AVANT chaque test, nos origines y sont inscrites.
 */

interface UrlProbe {
  ok: boolean;
  version?: string;
  error?: string;
  corsOk?: boolean;
  /** Même origine que la page : un navigateur n'a besoin d'aucun CORS. */
  sameOrigin?: boolean;
}

/** Jellyfin répond-il à cette adresse, et accepte-t-il l'origine donnée (CORS) ? */
async function probe(url: string, origin: string | null): Promise<UrlProbe> {
  if (!url) return { ok: false, error: "URL vide" };
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/System/Info/Public`, {
      // Un appel de serveur à serveur n'a pas d'en-tête Origin : on pose celui de la page.
      headers: origin ? { Origin: origin } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const info = (await res.json()) as { Version?: string };
    const sameOrigin = origin !== null && originOf(url) === origin;
    const acao = res.headers.get("access-control-allow-origin");
    return { ok: true, version: info.Version, sameOrigin, corsOk: sameOrigin || (!!acao && acao.length > 0) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unreachable" };
  }
}

export const adminDirectStreamingRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/direct-streaming — Read direct streaming settings. */
  app.get("/direct-streaming", async () => {
    const cfg = getDirectStreamingConfig();
    return {
      enabled: cfg.enabled,
      publicUrl: cfg.publicUrl ?? "",
      privateUrl: cfg.privateUrl ?? "",
    };
  });

  /** PUT /api/admin/direct-streaming — Update direct streaming settings. */
  app.put("/direct-streaming", async (request, reply) => {
    // L'adresse PRIVÉE suffit à allumer la lecture directe (réseau local) ; la
    // publique est facultative — `null` l'efface : hors de la maison, la
    // lecture passe alors par Tentacle. Une chaîne vide la laisse telle quelle
    // (les clients d'avant l'envoient ainsi).
    const schema = z.object({
      enabled: z.boolean(),
      publicUrl: z.string().url().optional().or(z.literal("")).nullable(),
      privateUrl: z.string().url().optional().or(z.literal("")),
    }).refine(
      (d) => !d.enabled || !!d.privateUrl || !!getDirectStreamingConfig().privateUrl,
      { message: "privateUrl is required when enabled" }
    );

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: parsed.error.issues[0].message });
    }
    const body = parsed.data;

    await setConfigValue("direct_streaming_enabled", String(body.enabled));
    if (body.publicUrl) {
      await setConfigValue("jellyfin_public_url", body.publicUrl.replace(/\/$/, ""));
    } else if (body.publicUrl === null) {
      await deleteConfigValue("jellyfin_public_url");
    }
    if (body.privateUrl) {
      await setConfigValue("jellyfin_private_url", body.privateUrl.replace(/\/$/, ""));
    }

    // Nos origines dans les CorsHosts de Jellyfin (jamais bloquant).
    await syncJellyfinCors({ requestOrigin: requestPageOrigin(request), trustRequestOrigin: true, logger: request.log });
    return { success: true };
  });

  /**
   * POST /api/admin/test-direct-streaming — Jellyfin répond-il aux adresses
   * données, et accepte-t-il l'origine de cette page ? Les CorsHosts sont mis
   * à jour AVANT la sonde : un CORS qui manquait est réparé, pas signalé.
   */
  app.post("/test-direct-streaming", async (request) => {
    const body = z.object({
      publicUrl: z.string().url().optional().or(z.literal("")),
      privateUrl: z.string().url().optional().or(z.literal("")),
    }).parse(request.body);

    const pageOrigin = requestPageOrigin(request);
    const cors = await syncJellyfinCors({ requestOrigin: pageOrigin, trustRequestOrigin: true, logger: request.log });
    const testOrigin = originOf(pageOrigin) ?? originOf(getPublicUrl());

    const [pub, priv] = await Promise.all([
      body.publicUrl ? probe(body.publicUrl, testOrigin) : Promise.resolve(null),
      body.privateUrl ? probe(body.privateUrl, testOrigin) : Promise.resolve(null),
    ]);

    return { public: pub, private: priv, cors };
  });
};
