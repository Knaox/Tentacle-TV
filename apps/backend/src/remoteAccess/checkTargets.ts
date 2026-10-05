import { isIP } from "net";
import { CHECK_MAX_TARGETS, isCheckablePort, type CheckTarget } from "./checkProtocol";
import type { ReverseProxyKind } from "./remoteAccessContract";

/**
 * Ce que le test d'ouverture vise, tiré des adresses DÉJÀ réglées :
 *
 * - le lien public de Tentacle s'il existe (son domaine, son port), sinon le
 *   port de Tentacle sur l'hôte, joint par l'adresse publique nue ;
 * - l'adresse publique de Jellyfin, si la lecture directe en a une ;
 * - derrière un mandataire, le port 80 du même domaine en plus : il doit
 *   rediriger vers HTTPS, jamais servir en clair.
 *
 * HTTPS d'abord : s'il faut couper à quatre cibles, c'est le port 80 qui saute.
 */
export interface CheckTargetsInput {
  publicUrl: string | null;
  jellyfinPublicUrl: string | null;
  proxy: ReverseProxyKind;
  hostPort: number;
}

function targetOf(service: CheckTarget["service"], raw: string): CheckTarget | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const scheme = url.protocol === "https:" ? "https" : "http";
  const port = url.port ? Number(url.port) : scheme === "https" ? 443 : 80;
  if (!isCheckablePort(port)) return null;
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  // Une adresse IP nue n'a pas de nom à présenter : le service joint l'adresse du demandeur.
  return isIP(hostname) ? { service, scheme, port } : { service, scheme, port, host: hostname.toLowerCase() };
}

export function planCheckTargets(input: CheckTargetsInput): CheckTarget[] {
  const primary: CheckTarget[] = [];
  const redirects: CheckTarget[] = [];

  const tentacle = input.publicUrl ? targetOf("tentacle", input.publicUrl) : null;
  primary.push(tentacle ?? { service: "tentacle", scheme: "http", port: input.hostPort });
  const jellyfin = input.jellyfinPublicUrl ? targetOf("jellyfin", input.jellyfinPublicUrl) : null;
  if (jellyfin) primary.push(jellyfin);

  if (input.proxy !== "none") {
    for (const target of primary) {
      if (target.scheme === "https" && target.port === 443 && target.host) redirects.push({ ...target, scheme: "http", port: 80 });
    }
  }
  return [...primary, ...redirects].slice(0, CHECK_MAX_TARGETS);
}
