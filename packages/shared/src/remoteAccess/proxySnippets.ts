/**
 * Les extraits à copier pour mettre un mandataire HTTPS devant Tentacle.
 *
 * - Piles Docker livrées (profils `caddy` et `traefik`) : la configuration
 *   est DÉJÀ dans le compose, générée depuis le `.env` — il ne reste que les
 *   domaines à y écrire et une commande à lancer.
 * - Mandataire existant (Caddy, Nginx / Nginx Proxy Manager, Traefik) : un
 *   bloc qui vise Tentacle (et Jellyfin) sur le réseau local, websockets
 *   compris (Watch Together, notifications).
 *
 * Les domaines sont VALIDÉS avant d'entrer dans un extrait : un retour à la
 * ligne glissé dans un nom deviendrait une ligne de configuration.
 */

export interface ProxySnippetInput {
  tentacleDomain: string;
  jellyfinDomain: string | null;
  /** L'adresse du serveur sur le réseau local, vue par le mandataire (ex. 192.168.1.20). */
  upstreamHost: string;
  tentaclePort: number;
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

function assertInput(input: ProxySnippetInput): void {
  const domains = [input.tentacleDomain, ...(input.jellyfinDomain ? [input.jellyfinDomain] : [])];
  if (!domains.every(isValidDomain)) throw new Error("invalid domain");
  if (!isValidUpstreamHost(input.upstreamHost)) throw new Error("invalid upstream host");
  for (const port of [input.tentaclePort, input.jellyfinPort]) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("invalid port");
  }
}

/** Les lignes à ajouter au `.env` d'une pile livrée (profils caddy / traefik). */
export function stackEnvLines(tentacleDomain: string, jellyfinDomain: string | null): string {
  if (!isValidDomain(tentacleDomain) || (jellyfinDomain && !isValidDomain(jellyfinDomain))) throw new Error("invalid domain");
  return [`TENTACLE_DOMAIN=${tentacleDomain}`, ...(jellyfinDomain ? [`JELLYFIN_DOMAIN=${jellyfinDomain}`] : [])].join("\n");
}

/** La commande qui démarre la pile avec son mandataire. */
export function stackProxyCommand(proxy: "caddy" | "traefik"): string {
  return `docker compose --profile ${proxy} up -d`;
}

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
  const out = [`${input.tentacleDomain} {`, `  reverse_proxy ${input.upstreamHost}:${input.tentaclePort}`, `}`];
  if (input.jellyfinDomain) {
    out.push(`${input.jellyfinDomain} {`, `  reverse_proxy ${input.upstreamHost}:${input.jellyfinPort} {`);
    out.push(`    header_down Access-Control-Allow-Origin "https://${input.tentacleDomain}"`);
    for (const [name, value] of CORS_HEADERS) out.push(`    header_down ${name} "${value}"`);
    out.push(`  }`, `}`);
  }
  return out.join("\n");
}

/** Un bloc `server` sans ses certificats : l'interface dit où les poser (Nginx Proxy Manager les gère seul). */
function nginxServer(domain: string, upstream: string, extra: string[]): string[] {
  return [
    `server {`,
    `  listen 443 ssl;`,
    `  http2 on;`,
    `  server_name ${domain};`,
    `  client_max_body_size 0;`,
    `  location / {`,
    `    proxy_pass http://${upstream};`,
    `    proxy_http_version 1.1;`,
    `    proxy_set_header Host $host;`,
    `    proxy_set_header X-Real-IP $remote_addr;`,
    `    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
    `    proxy_set_header X-Forwarded-Proto $scheme;`,
    `    proxy_set_header Upgrade $http_upgrade;`,
    `    proxy_set_header Connection "upgrade";`,
    `    proxy_buffering off;`,
    ...extra.map((line) => `    ${line}`),
    `  }`,
    `}`,
  ];
}

export function nginxSnippet(input: ProxySnippetInput): string {
  assertInput(input);
  const out = nginxServer(input.tentacleDomain, `${input.upstreamHost}:${input.tentaclePort}`, []);
  if (input.jellyfinDomain) {
    // Jellyfin envoie ses propres en-têtes CORS : on les retire avant de poser les nôtres.
    const cors = [
      `proxy_hide_header Access-Control-Allow-Origin;`,
      ...CORS_HEADERS.map(([name]) => `proxy_hide_header ${name};`),
      `add_header Access-Control-Allow-Origin "https://${input.tentacleDomain}" always;`,
      ...CORS_HEADERS.map(([name, value]) => `add_header ${name} "${value}" always;`),
    ];
    out.push("", ...nginxServer(input.jellyfinDomain, `${input.upstreamHost}:${input.jellyfinPort}`, cors));
  }
  return out.join("\n");
}

export function traefikSnippet(input: ProxySnippetInput): string {
  assertInput(input);
  const out = [
    `http:`,
    `  routers:`,
    `    tentacle:`,
    `      rule: Host(\`${input.tentacleDomain}\`)`,
    `      entryPoints: [websecure]`,
    `      service: tentacle`,
    `      tls: { certResolver: letsencrypt }`,
  ];
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
  out.push(`  services:`, `    tentacle:`, `      loadBalancer:`, `        servers: [{ url: "http://${input.upstreamHost}:${input.tentaclePort}" }]`);
  if (input.jellyfinDomain) {
    out.push(`    jellyfin:`, `      loadBalancer:`, `        servers: [{ url: "http://${input.upstreamHost}:${input.jellyfinPort}" }]`);
  }
  return out.join("\n");
}
