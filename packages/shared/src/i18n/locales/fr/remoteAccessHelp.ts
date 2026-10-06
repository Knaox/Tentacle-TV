/**
 * Le guide de l'accès à distance (intégré à la section d'administration,
 * ancre `#guide`). Sa STRUCTURE — sections, ordre, liens — vit dans
 * `packages/shared/src/help/remoteAccessGuide.ts` ; ici, les mots.
 *
 * Les conditions de Cloudflare sont citées par l'intitulé exact de leurs
 * sections (relevé le 2026-10-06). Espaces insécables (\u00a0) devant « ? »,
 * « : » et « ! ».
 */
export default {
  // ── Le guide ──────────────────────────────────────────────────────────
  guideTitle: "Le guide de l'accès à distance",
  guideIntro: "Pour joindre Tentacle hors de chez vous, plusieurs chemins existent. Ce guide dit lequel choisir, et comment.",
  choose_title: "Quel chemin choisir\u00a0?",
  choose_p1: "Le plus sûr et le plus simple\u00a0: un mandataire HTTPS devant Tentacle et Jellyfin, avec les ports 80 et 443 de la box redirigés vers lui. Les certificats se renouvellent seuls.",
  choose_p2: "La pile Docker de Tentacle n'embarque pas de mandataire\u00a0: gardez le vôtre (Nginx Proxy Manager, Caddy, Traefik), ou installez Caddy si vous n'en avez pas. L'étape 1 donne ce qu'il faut y poser.",
  choose_p3: "Ouvrir directement le port de Tentacle marche aussi, mais tout passe alors en clair\u00a0: à éviter, sauf pour un essai.",
  choose_p4: "Si rien ne peut s'ouvrir (adresse partagée par l'opérateur, box verrouillée), le plan B est un réseau privé comme Tailscale.",
  ports_title: "Ports, CGNAT et IPv6",
  ports_p1: "La box reçoit tout ce qui vient d'Internet. Une redirection de port lui dit\u00a0: «\u00a0ce qui arrive sur le port 443, envoie-le à ce serveur\u00a0». Donnez au serveur une adresse fixe dans la box (réservation DHCP), sinon la redirection vise un jour le mauvais appareil.",
  ports_p2: "Certains opérateurs partagent une même adresse IPv4 entre plusieurs clients (CGNAT, DS-Lite). La box n'a alors pas d'adresse publique à elle, et aucune redirection n'y fait rien. Pour le savoir, comparez l'adresse WAN affichée par la box à celle que le test voit depuis Internet\u00a0: différentes, ou comprises entre 100.64 et 100.127, c'est un partage. Le remède\u00a0: demander une IPv4 publique à l'opérateur, ou le plan B.",
  ports_p3: "En IPv6, chaque appareil a sa propre adresse\u00a0: rien à rediriger, mais le pare-feu de la box bloque souvent l'entrant. Autorisez-y le port pour ce serveur. Chez certains opérateurs, le préfixe IPv6 change régulièrement\u00a0: l'IPv4 reste alors le chemin le plus stable.",
  ports_p4: "Docker Desktop (Windows, macOS) ne transmet pas à Tentacle l'adresse réelle des visiteurs\u00a0: tout semble venir du réseau local. Pour un accès depuis Internet, préférez une machine Linux ou un NAS.",
  proxy_title: "Votre mandataire\u00a0: Caddy, Nginx, Traefik",
  proxy_p1: "Chaque domaine (par exemple tentacle.exemple.fr, et jellyfin.exemple.fr pour la lecture directe) doit pointer vers votre adresse publique\u00a0: un enregistrement DNS A, et AAAA si vous avez l'IPv6.",
  proxy_p2: "Dans le mandataire, un site par domaine\u00a0: Tentacle vers l'adresse locale de ce serveur et son port, Jellyfin vers le sien, websockets permis (Watch Together, notifications), et sur Jellyfin les en-têtes CORS de Tentacle à la place des siens. L'étape 1 écrit l'extrait en Caddyfile, en Nginx (Nginx Proxy Manager compris) ou en Traefik. Le certificat arrive seul dès que les ports 80 et 443 sont redirigés vers le mandataire.",
  proxy_p3: "Jellyfin derrière un mandataire\u00a0: déclarez l'adresse du mandataire parmi les proxies connus (Known proxies) des réglages réseau de Jellyfin, sinon il voit toutes les connexions venir du mandataire.",
  cloudflare_title: "Cloudflare\u00a0: pas pour la vidéo",
  cloudflare_p1: "Le proxy de Cloudflare (le nuage orange) et Cloudflare Tunnel sont pratiques pour une page web, mais leurs conditions limitent la vidéo. La section «\u00a0Content Delivery Network (Free, Pro, or Business)\u00a0» des conditions de service réserve la diffusion de vidéos et de gros fichiers aux services payants dédiés, et la FAQ de Cloudflare Tunnel applique la même règle aux noms d'hôte publics d'un tunnel. Cloudflare peut couper ou limiter un compte qui s'en sert pour du streaming.",
  cloudflare_p2: "Si votre DNS est chez Cloudflare, laissez les domaines de Tentacle et de Jellyfin en «\u00a0DNS only\u00a0» (nuage gris), et passez par votre propre mandataire.",
  cloudflare_p3: "Derrière le proxy de Cloudflare, n'acceptez à l'origine que les adresses de Cloudflare\u00a0: sinon, qui joint votre serveur en direct peut se faire passer pour un autre visiteur.",
  planB_title: "Plan B\u00a0: Tailscale",
  planB_p1: "Tailscale crée un réseau privé chiffré entre vos appareils, à travers n'importe quelle box, CGNAT compris. Rien à ouvrir, rien d'exposé sur Internet.",
  planB_p2: "Ses limites\u00a0: chaque appareil doit avoir Tailscale et être connecté à votre compte ; ceux qui ne peuvent pas l'installer n'y ont pas accès, et une connexion relayée est plus lente qu'une connexion directe. Tentacle ne l'intègre pas\u00a0: c'est une solution à part, documentée ici.",
  practices_title: "Bonnes pratiques",
  practices_p1: "Des mots de passe longs et uniques pour chaque compte Jellyfin, à commencer par l'administrateur.",
  practices_p2: "Tentacle et Jellyfin à jour\u00a0: chaque version corrige aussi des failles.",
  practices_p3: "Jamais d'administration en HTTP depuis Internet. Sur le mandataire, un outil comme fail2ban ou CrowdSec bloque les essais répétés de mots de passe.",

  // ── Les liens ─────────────────────────────────────────────────────────
  linksLabel: "Pour aller plus loin",
  link_jellyfinNetworking: "Jellyfin\u00a0: réseau et ports",
  link_jellyfinReverseProxy: "Jellyfin\u00a0: mandataire inverse et proxies connus",
  link_caddyReverseProxy: "Caddy\u00a0: reverse_proxy",
  link_caddyHttps: "Caddy\u00a0: HTTPS automatique",
  link_traefikFile: "Traefik\u00a0: fournisseur de fichier",
  link_traefikAcme: "Traefik\u00a0: certificats Let's Encrypt",
  link_cloudflareTerms: "Cloudflare\u00a0: conditions de service (CDN)",
  link_cloudflareTunnel: "Cloudflare Tunnel\u00a0: gros fichiers et streaming",
  link_tailscaleDownload: "Tailscale\u00a0: installation",
  link_tailscaleQuickstart: "Tailscale\u00a0: premiers pas",
  link_tailscaleNat: "Tailscale\u00a0: traverser le NAT (et le CGNAT)",
  link_jellyfinTailscale: "Jellyfin\u00a0: Tailscale",
};
