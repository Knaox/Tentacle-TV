import { request as httpRequest } from "http";
import { randomUUID } from "crypto";
import { z } from "zod";
import { guestRequestHeaders } from "../relay/relayHeaders";
import {
  PLUGIN_NAV_ITEMS_MAX,
  PLUGIN_NAV_LABEL_MAX,
  normalizeNavLabel,
  readNavigationDoc,
  safeNavigationPath,
  type PluginNavigationDoc,
} from "./pluginNavigation";

/**
 * L'hôte lit LUI-MÊME la route `navigation` d'une extension isolée, sur la
 * socket de son invité : un GET sans compte (la navigation vaut pour tous), un
 * corps borné, un délai court. La réponse est revalidée par Zod puis par la
 * lecture du contrat (`pluginNavigation.ts`) : un nom en texte nu, jamais du
 * HTML ; au moindre écart, rien n'est retenu.
 */

/** Au-delà, l'invité ne répond pas : la dernière valeur connue sert. */
const FETCH_TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 16 * 1024;

const NAVIGATION_SCHEMA = z.object({
  items: z
    .array(
      z.object({
        path: z.string().refine((value) => safeNavigationPath(value) !== null),
        label: z.string().max(PLUGIN_NAV_LABEL_MAX * 4).refine((value) => normalizeNavLabel(value) !== null).nullable(),
        primary: z.boolean(),
        // Masquée de toute la navigation : sans cette ligne, Zod la RETIRAIT en silence.
        hidden: z.boolean().optional(),
      }),
    )
    .max(PLUGIN_NAV_ITEMS_MAX),
});

/** La réponse de l'invité, validée deux fois ; `null` si elle n'est pas celle du contrat. */
export function parseNavigationBody(body: string): PluginNavigationDoc | null {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = NAVIGATION_SCHEMA.safeParse(raw);
  return parsed.success ? readNavigationDoc(parsed.data) : null;
}

export interface GuestSocketLookup {
  /** La socket de l'invité prêt, `null` s'il ne l'est pas (arrêté, en relance). */
  socketOf: (pluginId: string) => Promise<string | null>;
  locale: () => string;
}

export function createGuestNavigationFetch(lookup: GuestSocketLookup) {
  return async (pluginId: string, route: string): Promise<PluginNavigationDoc | null> => {
    const socket = await lookup.socketOf(pluginId);
    if (!socket) return null;
    const headers = guestRequestHeaders({ accept: "application/json" }, null, lookup.locale(), randomUUID());
    return new Promise<PluginNavigationDoc | null>((done) => {
      const req = httpRequest({ socketPath: socket, method: "GET", path: route, headers }, (res) => {
        if ((res.statusCode ?? 500) !== 200) {
          res.resume();
          done(null);
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            req.destroy();
            done(null);
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => done(parseNavigationBody(Buffer.concat(chunks).toString("utf8"))));
        res.on("error", () => done(null));
      });
      req.setTimeout(FETCH_TIMEOUT_MS, () => req.destroy());
      req.on("error", () => done(null));
      req.end();
    });
  };
}
