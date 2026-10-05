/**
 * The remote access guide (embedded in the admin section, `#guide` anchor).
 * Its structure lives in `packages/shared/src/help/remoteAccessGuide.ts`.
 */
export default {
  // ── The guide ─────────────────────────────────────────────────────────
  guideTitle: "Remote access guide",
  guideIntro: "There are several ways to reach Tentacle away from home. This guide says which one to choose, and how.",
  choose_title: "Which way to choose?",
  choose_p1: "The safest and simplest: an HTTPS reverse proxy (Caddy or Traefik) in front of Tentacle and Jellyfin, with the router's ports 80 and 443 forwarded to this server. Certificates renew on their own.",
  choose_p2: "Already running a proxy (Nginx Proxy Manager, Caddy, Traefik)? Add Tentacle to it: step 1 gives the snippet to copy.",
  choose_p3: "Opening Tentacle's port directly works too, but then everything travels in clear text: avoid it, except for a quick test.",
  choose_p4: "If nothing can be opened (address shared by your provider, locked router), plan B is a private network such as Tailscale.",
  ports_title: "Ports, CGNAT and IPv6",
  ports_p1: "Your router receives everything coming from the Internet. A port forwarding rule tells it: \"what arrives on port 443, send it to this server\". Give the server a fixed address in the router (DHCP reservation), otherwise the rule will one day point to the wrong device.",
  ports_p2: "Some providers share one IPv4 address between several customers (CGNAT, DS-Lite). Your router then has no public address of its own, and no forwarding helps. To find out, compare the WAN address shown by your router with the one the test sees from the Internet: different, or between 100.64 and 100.127, means sharing. The fix: ask your provider for a public IPv4, or plan B.",
  ports_p3: "With IPv6, every device has its own address: nothing to forward, but the router's firewall often blocks incoming traffic. Allow the port for this server there. With some providers, the IPv6 prefix changes regularly: IPv4 then stays the most stable way.",
  ports_p4: "Docker Desktop (Windows, macOS) does not pass visitors' real addresses to Tentacle: everything seems to come from the local network. For access from the Internet, prefer a Linux machine or a NAS.",
  proxy_title: "Caddy and Traefik",
  proxy_p1: "Each domain (for example tentacle.example.com, and jellyfin.example.com for direct play) must point to your public address: a DNS A record, and AAAA if you have IPv6.",
  proxy_p2: "Tentacle's Docker stacks already carry the configuration: write the domains in the .env file, then start the stack with the caddy or traefik profile. The certificate arrives on its own once ports 80 and 443 are forwarded.",
  proxy_p3: "Jellyfin behind a proxy: add the proxy's address to Jellyfin's Known proxies (network settings), otherwise it sees every connection coming from the proxy.",
  cloudflare_title: "Cloudflare: not for video",
  cloudflare_p1: "Cloudflare's proxy (the orange cloud) and Cloudflare Tunnel are handy for a web page, but their terms limit video. The \"Content Delivery Network (Free, Pro, or Business)\" section of the service terms reserves serving video and large files to dedicated paid services, and the Cloudflare Tunnel FAQ applies the same rule to a tunnel's public hostnames. Cloudflare may cut or limit an account that uses them for streaming.",
  cloudflare_p2: "If your DNS is at Cloudflare, keep Tentacle's and Jellyfin's domains on \"DNS only\" (grey cloud), and go through your own proxy.",
  cloudflare_p3: "Behind Cloudflare's proxy, only accept Cloudflare's addresses at the origin: otherwise, whoever reaches your server directly can pretend to be another visitor.",
  planB_title: "Plan B: Tailscale",
  planB_p1: "Tailscale creates an encrypted private network between your devices, through any router, CGNAT included. Nothing to open, nothing exposed on the Internet.",
  planB_p2: "Its limits: every device needs Tailscale and must be signed in to your account; those that cannot install it have no access, and a relayed connection is slower than a direct one. Tentacle does not integrate it: it is a separate solution, documented here.",
  practices_title: "Good practices",
  practices_p1: "Long, unique passwords for every Jellyfin account, starting with the administrator.",
  practices_p2: "Keep Tentacle and Jellyfin up to date: every release also fixes security issues.",
  practices_p3: "Never administer over HTTP from the Internet. On the proxy, a tool such as fail2ban or CrowdSec blocks repeated password attempts.",

  // ── Links ─────────────────────────────────────────────────────────────
  linksLabel: "Further reading",
  link_jellyfinNetworking: "Jellyfin: networking and ports",
  link_jellyfinReverseProxy: "Jellyfin: reverse proxy and known proxies",
  link_caddyReverseProxy: "Caddy: reverse_proxy",
  link_caddyHttps: "Caddy: automatic HTTPS",
  link_traefikFile: "Traefik: file provider",
  link_traefikAcme: "Traefik: Let's Encrypt certificates",
  link_cloudflareTerms: "Cloudflare: service terms (CDN)",
  link_cloudflareTunnel: "Cloudflare Tunnel: large files and streaming",
  link_tailscaleDownload: "Tailscale: download",
  link_tailscaleQuickstart: "Tailscale: quickstart",
  link_tailscaleNat: "Tailscale: NAT traversal (and CGNAT)",
  link_jellyfinTailscale: "Jellyfin: Tailscale",
};
