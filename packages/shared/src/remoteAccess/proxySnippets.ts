/**
 * Les extraits à copier pour mettre un mandataire HTTPS devant Tentacle.
 *
 * Les piles Docker livrées n'embarquent AUCUN mandataire : chacun garde le
 * sien (Caddy, Nginx / Nginx Proxy Manager, Traefik). Ces extraits sont ce
 * qu'on y pose — un bloc qui vise Tentacle (et Jellyfin) sur le réseau local,
 * websockets compris (Watch Together, notifications), et pour Jellyfin les
 * en-têtes CORS de l'application web de Tentacle, sans doublon. Ce sont les
 * mêmes que montrent l'administration et docs/server/remote-access.md, et que
 * le banc `apps/server-e2e` (proxies.e2e.ts) éprouve sur de vrais mandataires.
 *
 * Les domaines sont VALIDÉS avant d'entrer dans un extrait : un retour à la
 * ligne glissé dans un nom deviendrait une ligne de configuration.
 */

export interface ProxySnippetInput {
  tentacleDomain: string;
  /** Jellyfin sur SON domaine (`jf.example.com`) — exclusif avec `jellyfinPath`. */
  jellyfinDomain: string | null;
  /**
   * Jellyfin sous un CHEMIN du domaine de Tentacle (`/jellyfin`) : même
   * origine que l'application web, donc aucun en-tête CORS à poser. Jellyfin
   * doit avoir la même « URL de base » (Réseau, dans son tableau de bord).
   */
  jellyfinPath?: string | null;
  /** L'adresse de Tentacle sur le réseau local, vue par le mandataire (ex. 192.168.1.20). */
  upstreamHost: string;
  tentaclePort: number;
  /** L'adresse de Jellyfin vue par le mandataire, si elle n'est pas celle de Tentacle. */
  jellyfinUpstreamHost?: string | null;
  jellyfinPort: number;
}

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** Un nom de domaine complet (au moins deux étiquettes), en minuscules. */
export function isValidDomain(value: string): boolean {
  const name = value.trim().toLowerCase().replace(/\.$/, "");
  if (name.length === 0 || name.length > 253) return false;
  const labels = name.split(".");
  return labels.length >= 2 && labels.every((l) => LABEL.test(l)) && !/^\d+$/.test(labels[labels.length - 1]);
}

/** Une adresse IPv4, un nom d'hôte ou une IPv6 entre crochets — rien qui casse une ligne. */
export function isValidUpstreamHost(value: string): boolean {
  return /^(\[[0-9a-fA-F:.]+\]|[A-Za-z0-9.-]{1,253})$/.test(value);
}

/** Un chemin d'URL simple (`/jellyfin`, `/media/jf`), sans barre finale ni caractère qui casse une ligne. */
export function isValidBasePath(value: string): boolean {
  return /^(\/[A-Za-z0-9._~-]+)+$/.test(value);
}

/** Le chemin d'une adresse (`https://tv.example.com/jellyfin/` → `/jellyfin`), ou `null` à la racine. */
export function basePathOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    return path && isValidBasePath(path) ? path : null;
  } catch {
    return null;
  }
}

function assertInput(input: ProxySnippetInput): void {
  const domains = [input.tentacleDomain, ...(input.jellyfinDomain ? [input.jellyfinDomain] : [])];
  if (!domains.every(isValidDomain)) throw new Error("invalid domain");
  if (input.jellyfinDomain && input.jellyfinPath) throw new Error("jellyfin: domain or path, not both");
  if (input.jellyfinPath && !isValidBasePath(input.jellyfinPath)) throw new Error("invalid path");
  for (const host of [input.upstreamHost, ...(input.jellyfinUpstreamHost ? [input.jellyfinUpstreamHost] : [])]) {
    if (!isValidUpstreamHost(host)) throw new Error("invalid upstream host");
  }
  for (const port of [input.tentaclePort, input.jellyfinPort]) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("invalid port");
  }
}

const tentacleTarget = (input: ProxySnippetInput) => `${input.upstreamHost}:${input.tentaclePort}`;
const jellyfinTarget = (input: ProxySnippetInput) => `${input.jellyfinUpstreamHost || input.upstreamHost}:${input.jellyfinPort}`;

/** Les en-têtes CORS que Jellyfin doit renvoyer à l'application web de Tentacle (sans doublon). */
const CORS_HEADERS: Array<[string, string]> = [
  ["Access-Control-Allow-Credentials", "true"],
  ["Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE, PUT, PATCH"],
  [
    "Access-Control-Allow-Headers",
    "Authorization, X-Emby-Token, X-Emby-Authorization, X-Requested-With, Content-Type, Range, If-Modified-Since, Cache-Control",
  ],
  ["Access-Control-Expose-Headers", "Content-Length, Content-Range, Date, Server"],
];

export function caddySnippet(input: ProxySnippetInput): string {
  assertInput(input);
  const path = input.jellyfinPath;
  // Sous un chemin : Jellyfin d'abord (le chemin garde son préfixe), Tentacle pour le reste.
  const out = path
    ? [
        `${input.tentacleDomain} {`,
        `  redir ${path} ${path}/`,
        `  handle ${path}/* {`,
        `    reverse_proxy ${jellyfinTarget(input)}`,
        `  }`,
        `  handle {`,
        `    reverse_proxy ${tentacleTarget(input)}`,
        `  }`,
        `}`,
      ]
    : [`${input.tentacleDomain} {`, `  reverse_proxy ${tentacleTarget(input)}`, `}`];
  if (input.jellyfinDomain) {
    out.push(`${input.jellyfinDomain} {`, `  reverse_proxy ${jellyfinTarget(input)} {`);
    out.push(`    header_down Access-Control-Allow-Origin "https://${input.tentacleDomain}"`);
    for (const [name, value] of CORS_HEADERS) out.push(`    header_down ${name} "${value}"`);
    out.push(`  }`, `}`);
  }
  return out.join("\n");
}

interface NginxLocation {
  path: string;
  upstream: string;
  extra?: string[];
}

const PROXY_LINES = [
  `proxy_http_version 1.1;`,
  `proxy_set_header Host $host;`,
  `proxy_set_header X-Real-IP $remote_addr;`,
  `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
  `proxy_set_header X-Forwarded-Proto $scheme;`,
  `proxy_set_header Upgrade $http_upgrade;`,
  `proxy_set_header Connection "upgrade";`,
  `proxy_buffering off;`,
];

/** Un bloc `server` sans ses certificats : l'interface dit où les poser (Nginx Proxy Manager les gère seul). */
function nginxServer(domain: string, locations: NginxLocation[], redirects: string[] = []): string[] {
  return [
    `server {`,
    `  listen 443 ssl;`,
    `  http2 on;`,
    `  server_name ${domain};`,
    `  client_max_body_size 0;`,
    ...redirects.map((path) => `  location = ${path} { return 302 $scheme://$host${path}/; }`),
    ...locations.flatMap((location) => [
      `  location ${location.path} {`,
      `    proxy_pass http://${location.upstream};`,
      ...[...PROXY_LINES, ...(location.extra ?? [])].map((line) => `    ${line}`),
      `  }`,
    ]),
    `}`,
  ];
}

export function nginxSnippet(input: ProxySnippetInput): string {
  assertInput(input);
  const path = input.jellyfinPath;
  // Sous un chemin : sans barre finale, proxy_pass garde le préfixe que Jellyfin attend (son URL de base).
  const out = path
    ? nginxServer(input.tentacleDomain, [{ path: `${path}/`, upstream: jellyfinTarget(input) }, { path: "/", upstream: tentacleTarget(input) }], [path])
    : nginxServer(input.tentacleDomain, [{ path: "/", upstream: tentacleTarget(input) }]);
  if (input.jellyfinDomain) {
    // Jellyfin envoie ses propres en-têtes CORS : on les retire avant de poser les nôtres.
    const cors = [
      `proxy_hide_header Access-Control-Allow-Origin;`,
      ...CORS_HEADERS.map(([name]) => `proxy_hide_header ${name};`),
      `add_header Access-Control-Allow-Origin "https://${input.tentacleDomain}" always;`,
      ...CORS_HEADERS.map(([name, value]) => `add_header ${name} "${value}" always;`),
    ];
    out.push("", ...nginxServer(input.jellyfinDomain, [{ path: "/", upstream: jellyfinTarget(input), extra: cors }]));
  }
  return out.join("\n");
}

export function traefikSnippet(input: ProxySnippetInput): string {
  assertInput(input);
  const path = input.jellyfinPath;
  const out = [
    `http:`,
    `  routers:`,
    `    tentacle:`,
    `      rule: Host(\`${input.tentacleDomain}\`)`,
    `      entryPoints: [websecure]`,
    `      service: tentacle`,
    `      tls: { certResolver: letsencrypt }`,
  ];
  if (path) {
    // La règle la plus longue l'emporte : le chemin de Jellyfin passe avant Tentacle.
    out.push(
      `    jellyfin:`,
      `      rule: Host(\`${input.tentacleDomain}\`) && PathPrefix(\`${path}\`)`,
      `      entryPoints: [websecure]`,
      `      service: jellyfin`,
      `      tls: { certResolver: letsencrypt }`,
    );
  }
  if (input.jellyfinDomain) {
    out.push(
      `    jellyfin:`,
      `      rule: Host(\`${input.jellyfinDomain}\`)`,
      `      entryPoints: [websecure]`,
      `      service: jellyfin`,
      `      middlewares: [jellyfin-cors]`,
      `      tls: { certResolver: letsencrypt }`,
      `  middlewares:`,
      `    jellyfin-cors:`,
      `      headers:`,
      `        accessControlAllowOriginList: ["https://${input.tentacleDomain}"]`,
      `        accessControlAllowCredentials: true`,
      `        accessControlAllowMethods: [GET, POST, OPTIONS, DELETE, PUT, PATCH]`,
      `        accessControlAllowHeaders: [Authorization, X-Emby-Token, X-Emby-Authorization, X-Requested-With, Content-Type, Range, If-Modified-Since, Cache-Control]`,
      `        accessControlExposeHeaders: [Content-Length, Content-Range, Date, Server]`,
      `        addVaryHeader: true`,
    );
  }
  out.push(`  services:`, `    tentacle:`, `      loadBalancer:`, `        servers: [{ url: "http://${tentacleTarget(input)}" }]`);
  if (input.jellyfinDomain || path) {
    out.push(`    jellyfin:`, `      loadBalancer:`, `        servers: [{ url: "http://${jellyfinTarget(input)}" }]`);
  }
  return out.join("\n");
}
