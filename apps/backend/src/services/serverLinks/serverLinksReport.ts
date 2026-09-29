import { getConfigValue, getDirectStreamingConfig, getJellyfinApiKey, getJellyfinUrl, getPublicUrl } from "../configStore";
import { jellyfinAcceptsLegacyAuth } from "../jellyfinLegacyAuth";
import type { ServerLinksDraft, ServerLinksReport } from "./serverLinksContract";
import { connectedJellyfinId, probeJellyfin, probeTentacle } from "./serverLinksProbe";

/**
 * Le rapport des liens du serveur : les adresses (enregistrées, ou un
 * brouillon de l'assistant) et ce que leurs sondes ont trouvé. Tout part en
 * parallèle — quatre secondes au pire, jamais la somme des attentes.
 *
 * Aucun verdict ici : il se tire côté clients, d'une seule règle
 * (`packages/shared/src/serverLinks/serverLinksVerdict.ts`).
 */

interface Links {
  tentacleUrl: string | null;
  source: "config" | "env" | null;
  enabled: boolean;
  jellyfinPublicUrl: string | null;
  jellyfinPrivateUrl: string | null;
}

const clean = (url: string | null | undefined): string | null => (url ?? "").trim().replace(/\/+$/, "") || null;

/** L'origine d'une adresse (« https://tv.example.com ») : ce que le navigateur envoie à Jellyfin. */
function originOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function savedLinks(): Links {
  const direct = getDirectStreamingConfig();
  const tentacleUrl = getPublicUrl();
  return {
    tentacleUrl,
    source: !tentacleUrl ? null : clean(getConfigValue("public_url")) ? "config" : "env",
    enabled: direct.enabled,
    jellyfinPublicUrl: clean(direct.publicUrl),
    jellyfinPrivateUrl: clean(direct.privateUrl),
  };
}

function draftLinks(draft: ServerLinksDraft): Links {
  const jellyfinPublicUrl = clean(draft.jellyfinPublicUrl);
  const jellyfinPrivateUrl = clean(draft.jellyfinPrivateUrl);
  const tentacleUrl = clean(draft.publicUrl);
  return {
    tentacleUrl,
    source: tentacleUrl ? "config" : null,
    // Le serveur n'allume la lecture directe qu'avec ses deux adresses.
    enabled: jellyfinPublicUrl !== null && jellyfinPrivateUrl !== null,
    jellyfinPublicUrl,
    jellyfinPrivateUrl,
  };
}

async function legacyRelayed(): Promise<boolean | null> {
  if (!getJellyfinUrl() || !getJellyfinApiKey()) return null;
  return !(await jellyfinAcceptsLegacyAuth());
}

/**
 * `requestOrigin` : l'origine de la page qui demande, quand aucun lien
 * public n'est connu — c'est alors elle qui lira Jellyfin en direct.
 */
async function buildReport(links: Links, requestOrigin: string | null): Promise<ServerLinksReport> {
  const origin = originOf(links.tentacleUrl) ?? requestOrigin;
  // Lu en même temps que les sondes, qui l'attendent chacune après leur propre réponse.
  const expectedId = connectedJellyfinId(getJellyfinUrl());
  const [tentacle, publicProbe, privateProbe, legacy] = await Promise.all([
    links.tentacleUrl ? probeTentacle(links.tentacleUrl) : null,
    links.jellyfinPublicUrl ? probeJellyfin(links.jellyfinPublicUrl, { expectedId, origin }) : null,
    // Sur le réseau local, ce sont surtout les applications qui lisent : le CORS n'y est pas mesuré.
    links.jellyfinPrivateUrl ? probeJellyfin(links.jellyfinPrivateUrl, { expectedId, origin: null }) : null,
    legacyRelayed(),
  ]);
  return {
    checkedAt: new Date().toISOString(),
    tentacle: { url: links.tentacleUrl, source: links.source, probe: tentacle },
    direct: {
      enabled: links.enabled,
      publicUrl: links.jellyfinPublicUrl,
      privateUrl: links.jellyfinPrivateUrl,
      publicProbe,
      privateProbe,
    },
    legacyClientsRelayed: legacy,
    jellyfinUrl: clean(getJellyfinUrl()),
  };
}

/** Les liens enregistrés, sondés. */
export function buildServerLinksReport(requestOrigin: string | null): Promise<ServerLinksReport> {
  return buildReport(savedLinks(), requestOrigin);
}

/** Un brouillon (l'assistant, avant d'enregistrer), sondé de la même façon. */
export function checkServerLinksDraft(draft: ServerLinksDraft, requestOrigin: string | null): Promise<ServerLinksReport> {
  return buildReport(draftLinks(draft), requestOrigin);
}
