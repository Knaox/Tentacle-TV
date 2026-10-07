# Accès à distance

*English version: [../remote-access.md](../remote-access.md).*

Tentacle vous guide dans **Administration › Accès à distance** (et dans l'étape facultative de l'assistant) —
le même panneau, les mêmes règles aux deux endroits.

## Privé ou public

- **Privé** (le défaut) : seuls les appareils de la maison joignent Tentacle, par son adresse privée —
  *l'adresse de ce serveur sur votre réseau*, par exemple `http://192.168.1.20:3000`, proposée d'après l'adresse
  par laquelle vous avez ouvert la page.
- **Public** : vos proches le joignent de chez eux, par l'adresse publique de votre box (affichée, détectée
  automatiquement).

**Ce qui est réglé est publié**, comme en 1.23.0 : le lien public de Tentacle et l'adresse publique de Jellyfin
sont donnés aux applications dès qu'ils sont réglés ; sans lien public, Tentacle ne répond qu'à la maison (le
jumelage des TV reçoit l'adresse privée du serveur : il continue de marcher). La page s'ouvre sur l'état, en
lecture seule — ce que reçoivent les applications chez vous et hors de chez vous —, puis sur les **adresses**, les
seules choses à régler : lien public, lecture directe, adresse de Jellyfin sur le réseau et adresse publique de
Jellyfin. Un serveur venu d'une version précédente les retrouve préremplies, sans rien à refaire. Tout le reste
(mandataire, ports, test) est replié dans **En savoir plus** : rien n'y est obligatoire.

L'adresse publique de la box est celle vue par le dernier test d'ouverture, sinon demandée à la page
`cdn-cgi/trace` de Cloudflare (IPv4, sans compte, au plus toutes les dix minutes) ; `REMOTE_CHECK_URL=off` coupe
les deux.

**CORS** : Tentacle inscrit lui-même ses adresses (lien public, adresse locale, page de l'administrateur,
application de bureau) dans les hôtes CORS de Jellyfin — au démarrage, au retour de Jellyfin, à chaque
enregistrement et avant chaque test. Une liste vide ou qui contient `*` n'est jamais touchée : Jellyfin y accepte
déjà toutes les origines. Rien à faire de ce côté.

**Lecture directe** : l'adresse privée de Jellyfin suffit à l'allumer (l'installation l'allume à la maison). Son
**adresse publique est facultative** : sans elle, hors de la maison, la lecture passe par Tentacle — seul le
port de Tentacle est à ouvrir.

## 1. Un mandataire HTTPS devant (conseillé)

**Facultatif.** Caddy, Traefik et Nginx ne sont **ni inclus ni installés** par Tentacle : n'en choisissez un que
si vous l'avez déjà ; sinon, gardez « Sans mandataire » (le défaut). Un mandataire est un programme qui reçoit les
visites d'Internet et les transmet à Tentacle en ajoutant le HTTPS.

Les piles Docker **n'embarquent pas de mandataire** : vous en avez sans doute déjà un (Nginx Proxy Manager,
Caddy, Traefik…), et Tentacle se range simplement derrière. Si vous n'en avez pas encore, Caddy est le plus
simple à installer (paquet du système ou son propre conteneur) : les certificats sont automatiques.

| Ce qui reçoit Internet | Quoi faire |
|---|---|
| **Caddy** | ajouter le bloc de Caddyfile ci-dessous |
| **Nginx / Nginx Proxy Manager** (ou un autre mandataire) | un hôte par domaine, websockets activés — le bloc Nginx ci-dessous pour modèle |
| **Traefik** | ajouter le fichier de routes ci-dessous à son fournisseur de fichier (sans socket Docker) |
| Sans mandataire | le port de Tentacle ouvert tel quel : **tout passe en clair** — à éviter |

**Administration › Accès à distance** écrit ces blocs avec vos domaines et l'adresse de ce serveur (étape 1).
Chaque domaine a besoin d'un enregistrement DNS **A** (et **AAAA** si vous avez l'IPv6) vers votre adresse
publique ; le domaine de Jellyfin ne sert qu'à la lecture directe depuis Internet. Les exemples ci-dessous
prennent `tentacle.exemple.fr`, `jellyfin.exemple.fr` et un serveur en `192.168.1.20` aux ports par défaut
(3000, 8096) : remplacez-les par les vôtres. Un mandataire placé dans le **même réseau Docker** que la pile
peut viser les services par leur nom : `tentacle:3000` et `jellyfin:8096`.

Sur Jellyfin, le mandataire pose **les en-têtes CORS de Tentacle à la place de ceux de Jellyfin** (jamais les
deux : un `Access-Control-Allow-Origin` en double fait tout refuser par le navigateur).

**Jellyfin sous un chemin du domaine de Tentacle** (`https://tentacle.exemple.fr/jellyfin`) : un seul site, le
chemin vers Jellyfin, le reste vers Tentacle — et **aucun en-tête CORS**, la même origine n'en a pas besoin. Dans
Jellyfin › Tableau de bord › Réseau, réglez l'« URL de base » sur le même chemin. La page écrit cet exemple aussi
(« Un chemin du domaine de Tentacle »), avec l'adresse de Jellyfin sur le réseau si ce n'est pas celle de Tentacle.

### Caddy

Caddy obtient et renouvelle seul les certificats dès que les ports 80 et 443 lui parviennent.

```caddyfile
tentacle.exemple.fr {
  reverse_proxy 192.168.1.20:3000
}
jellyfin.exemple.fr {
  reverse_proxy 192.168.1.20:8096 {
    header_down Access-Control-Allow-Origin "https://tentacle.exemple.fr"
    header_down Access-Control-Allow-Credentials "true"
    header_down Access-Control-Allow-Methods "GET, POST, OPTIONS, DELETE, PUT, PATCH"
    header_down Access-Control-Allow-Headers "Authorization, X-Emby-Token, X-Emby-Authorization, X-Requested-With, Content-Type, Range, If-Modified-Since, Cache-Control"
    header_down Access-Control-Expose-Headers "Content-Length, Content-Range, Date, Server"
  }
}
```

### Nginx / Nginx Proxy Manager

Dans **Nginx Proxy Manager** : un *Proxy Host* par domaine, vers `http://192.168.1.20:3000` (Tentacle) et
`http://192.168.1.20:8096` (Jellyfin), avec *Websockets Support*, un certificat Let's Encrypt et *Force SSL* ;
les lignes CORS de Jellyfin (`proxy_hide_header` / `add_header`) vont dans son onglet *Advanced*. Avec **Nginx**
seul, ajoutez vos lignes `ssl_certificate` et `ssl_certificate_key` :

```nginx
server {
  listen 443 ssl;
  http2 on;
  server_name tentacle.exemple.fr;
  client_max_body_size 0;
  location / {
    proxy_pass http://192.168.1.20:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
  }
}

server {
  listen 443 ssl;
  http2 on;
  server_name jellyfin.exemple.fr;
  client_max_body_size 0;
  location / {
    proxy_pass http://192.168.1.20:8096;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    proxy_hide_header Access-Control-Allow-Origin;
    proxy_hide_header Access-Control-Allow-Credentials;
    proxy_hide_header Access-Control-Allow-Methods;
    proxy_hide_header Access-Control-Allow-Headers;
    proxy_hide_header Access-Control-Expose-Headers;
    add_header Access-Control-Allow-Origin "https://tentacle.exemple.fr" always;
    add_header Access-Control-Allow-Credentials "true" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, DELETE, PUT, PATCH" always;
    add_header Access-Control-Allow-Headers "Authorization, X-Emby-Token, X-Emby-Authorization, X-Requested-With, Content-Type, Range, If-Modified-Since, Cache-Control" always;
    add_header Access-Control-Expose-Headers "Content-Length, Content-Range, Date, Server" always;
  }
}
```

### Traefik

Un fichier de routes pour le **fournisseur de fichier** de Traefik. `websecure` et `letsencrypt` sont les noms
habituels du point d'entrée HTTPS et du résolveur de certificats ACME : remplacez-les par les vôtres.

```yaml
http:
  routers:
    tentacle:
      rule: Host(`tentacle.exemple.fr`)
      entryPoints: [websecure]
      service: tentacle
      tls: { certResolver: letsencrypt }
    jellyfin:
      rule: Host(`jellyfin.exemple.fr`)
      entryPoints: [websecure]
      service: jellyfin
      middlewares: [jellyfin-cors]
      tls: { certResolver: letsencrypt }
  middlewares:
    jellyfin-cors:
      headers:
        accessControlAllowOriginList: ["https://tentacle.exemple.fr"]
        accessControlAllowCredentials: true
        accessControlAllowMethods: [GET, POST, OPTIONS, DELETE, PUT, PATCH]
        accessControlAllowHeaders: [Authorization, X-Emby-Token, X-Emby-Authorization, X-Requested-With, Content-Type, Range, If-Modified-Since, Cache-Control]
        accessControlExposeHeaders: [Content-Length, Content-Range, Date, Server]
        addVaryHeader: true
  services:
    tentacle:
      loadBalancer:
        servers: [{ url: "http://192.168.1.20:3000" }]
    jellyfin:
      loadBalancer:
        servers: [{ url: "http://192.168.1.20:8096" }]
```

Puis déclarez le mandataire à Jellyfin : son adresse dans les **proxies connus** (*Known proxies*, Tableau de
bord › Réseau), sinon toutes les connexions semblent venir du mandataire. Pour Tentacle, voir
[Mandataires de confiance](#mandataires-de-confiance).

## 2. Ouvrir les ports de la box

| Derrière un mandataire | Sans mandataire |
|---|---|
| **443** (HTTPS) et **80** (redirection vers HTTPS, renouvellement des certificats) → la machine du mandataire | le port de Tentacle (`TENTACLE_PORT`, 3000) → cette machine ; celui de Jellyfin (`JELLYFIN_PORT`, 8096) seulement pour la lecture directe hors de la maison — le panneau donne les deux avec leurs vrais numéros |

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
