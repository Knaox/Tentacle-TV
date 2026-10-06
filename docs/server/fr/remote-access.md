# Accès à distance

*English version: [../remote-access.md](../remote-access.md).*

Tentacle vous guide dans **Administration › Accès à distance** (et dans l'étape facultative de l'assistant).
Trois étapes : ce qui reçoit Internet, les ports de la box, et un test mené **depuis l'extérieur**.

## 1. Un mandataire HTTPS devant (conseillé)

| Option | Quand |
|---|---|
| **Caddy** (profil `caddy` de *tentacle-full*) | le plus simple : certificats automatiques |
| **Traefik** (profil `traefik`, fournisseur de fichier — sans socket Docker) | vous préférez Traefik |
| **Votre mandataire** (Nginx Proxy Manager, Caddy, Traefik…) | il tourne déjà chez vous : la page d'administration génère l'extrait |
| Sans mandataire | le port de Tentacle ouvert tel quel : **tout passe en clair** — à éviter |

Avec les piles :

```bash
# .env à côté de compose.yaml
TENTACLE_DOMAIN=tentacle.exemple.fr
JELLYFIN_DOMAIN=jellyfin.exemple.fr    # seulement pour la lecture directe depuis Internet
```

```bash
docker compose --profile caddy up -d     # ou : --profile traefik
```

Chaque domaine a besoin d'un enregistrement DNS **A** (et **AAAA** si vous avez l'IPv6) vers votre adresse
publique. La configuration (en-têtes CORS de Jellyfin compris, jamais en double) est déjà dans le compose.

## 2. Ouvrir les ports de la box

| Derrière un mandataire | Sans mandataire |
|---|---|
| **443** (HTTPS) et **80** (redirection vers HTTPS, renouvellement des certificats) → cette machine | le port de Tentacle (`TENTACLE_PORT`, 3000) → cette machine ; celui de Jellyfin (8096) seulement pour la lecture directe |

Donnez au serveur une **adresse fixe** dans la box (réservation DHCP). La page d'administration renvoie aux
guides officiels de Swisscom, Sunrise, Salt, Free, Orange et Bouygues (vérifiés le 2026-10-06 ; le site de SFR
n'a pas pu l'être — cherchez « redirection de ports » dans son assistance).

**IPv6** : rien à rediriger (chaque appareil a sa propre adresse), mais le pare-feu de la box bloque souvent
l'entrant : autorisez-y le port pour ce serveur.

## 3. Tester depuis l'extérieur

Le bouton **Lancer le test** demande à un service externe (`check.tentacletv.app`, réglable par
`REMOTE_CHECK_URL`, `off` pour le couper) de joindre votre serveur comme le ferait un téléphone en 4G — en IPv4,
puis en IPv6. Le service **ne teste que l'adresse d'où vient la demande** : il ne sonde jamais une adresse
qu'on lui donne, et ne suit un domaine que s'il désigne cette même adresse. Tentacle prouve que c'est bien lui
qui répond par un défi à usage unique (`/.well-known/tentacle-check/<id>`, 60 secondes).

Résultats, par service : *joignable en HTTPS* (le but), *exposé en HTTP* (en rouge : les mots de passe passent
en clair), *à vérifier* (certificat, mandataire), *injoignable* — avec la cause probable en mots simples : port
non redirigé, mauvais appareil, certificat, DNS, pare-feu IPv6, ou adresse partagée (CGNAT).

## CGNAT : quand rien ne s'ouvre

Certains opérateurs partagent une même IPv4 entre plusieurs clients (CGNAT, DS-Lite) : aucune redirection n'y
fait rien. Pour le savoir, comparez l'**adresse WAN affichée par la box** à celle que voit le test (la page
d'administration le fait) : différentes, ou entre `100.64.x.x` et `100.127.x.x`, c'est un partage. Remèdes :
demander une IPv4 publique à l'opérateur (Sunrise : passage en IPv4 sur demande ; Salt : option payante ; Free :
« IPv4 fixe full-stack » dans l'Espace Abonné), ou le **plan B**.

### Plan B : Tailscale (documenté, pas intégré)

Tailscale crée un réseau privé chiffré entre vos appareils, à travers n'importe quelle box (CGNAT compris) :
rien à ouvrir, rien d'exposé. Chaque appareil doit avoir Tailscale et votre compte ; ceux qui ne peuvent pas
l'installer n'y ont pas accès, et une connexion relayée est plus lente. Tentacle ne l'intègre pas.
[Installation](https://tailscale.com/download) · [Premiers pas](https://tailscale.com/docs/how-to/quickstart) ·
[Traverser le NAT](https://tailscale.com/blog/how-nat-traversal-works) ·
[Jellyfin et Tailscale](https://jellyfin.org/docs/general/post-install/networking/tailscale/)

## Cloudflare : pas pour la vidéo

Le proxy de Cloudflare (nuage orange) et Cloudflare Tunnel sont pratiques pour une page web, mais leurs
conditions limitent la vidéo : la section **« Content Delivery Network (Free, Pro, or Business) »** des
[conditions de service](https://www.cloudflare.com/service-specific-terms-application-services/#content-delivery-network-free-pro-or-business)
réserve la diffusion de vidéos et de gros fichiers aux services payants dédiés, et la
[FAQ de Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/#large-file-and-streaming-traffic-through-tunnel)
applique la même règle aux noms d'hôte publics d'un tunnel. Laissez les domaines de Tentacle et de Jellyfin en
**DNS only** (nuage gris) et passez par votre propre mandataire. Derrière le proxy de Cloudflare, n'acceptez à
l'origine que les adresses de Cloudflare — sinon `CF-Connecting-IP` est falsifiable par qui joint votre serveur
en direct.

## Mandataires de confiance

Tentacle ne croit `X-Forwarded-For`, `X-Real-IP` et `CF-Connecting-IP` que **de ses voisins** : la machine, le
réseau local et les réseaux Docker (127/8, 10/8, 172.16/12, 192.168/16, ::1, fc00::/7). Un mandataire hors de
ces plages : ajoutez-le par `TRUSTED_PROXIES` (IP ou CIDR, séparés par des virgules). La limite des connexions
et la détection du réseau local (plafonds de débit, adresse privée de Jellyfin) ne se laissent ainsi pas
tromper.

**Docker Desktop (Windows, macOS) et colima** ne transmettent pas aux conteneurs l'adresse réelle des
visiteurs : tout semble venir de la passerelle Docker, et chaque client paraît « local ». Pour un accès depuis
Internet, préférez une machine Linux ou un NAS.

## Bonnes pratiques

Des mots de passe longs et uniques pour chaque compte Jellyfin (l'administrateur d'abord) · Tentacle et
Jellyfin à jour · jamais d'administration en HTTP depuis Internet · sur le mandataire, fail2ban ou CrowdSec
bloquent les essais répétés de mots de passe.
