# Installer Tentacle

*English version: [../install.md](../install.md).*

## Quelle pile ?

| Pile | Contient | À choisir quand |
|---|---|---|
| **tentacle-full** (conseillée) | Tentacle et **Jellyfin** | vous partez de zéro, ou voulez tout au même endroit |
| **tentacle-only** | Tentacle seul | Jellyfin tourne déjà ailleurs (NAS, autre conteneur, installation native) |

Aucune base à installer, dans aucune des deux piles : depuis la 1.25, Tentacle garde ses données dans **un
fichier**, `data/tentacle.db` (SQLite), de son volume de données — voir [Base de données](#base-de-données). Vous
mettez à jour une installation qui utilisait MariaDB ou MySQL (l'ancienne pile `tentacle-db`, une pile avec un
service `db`, `DATABASE_URL`…) ? **Gardez votre fichier actuel** — ne prenez pas encore ces piles — et mettez
l'image à jour : Tentacle migre ses données de lui-même, puis le tableau de bord dit quand et comment passer
à la nouvelle pile : [sqlite-migration.md](sqlite-migration.md).

Chaque pile est un seul `compose.yaml`, prêt à copier, avec un `.env.example` commenté à côté. **Rien n'est
obligatoire dans `.env`** : chaque valeur a un défaut qui marche. Aucune pile n'embarque de mandataire : pour
le HTTPS depuis Internet, placez Tentacle derrière le vôtre ([remote-access.md](remote-access.md)).

```bash
mkdir tentacle && cd tentacle
# UNE des deux :
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-full/compose.yaml
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-only/compose.yaml
docker compose up -d
```

## Premier démarrage : ouvrir l'assistant

Ouvrez `http://<cette-machine>:3000` (ou le port choisi). **Depuis le réseau de la maison, c'est tout** : le
premier navigateur qui joint Tentacle directement depuis une adresse privée (192.168.x.x, 10.x.x.x,
172.16-31.x.x, ULA IPv6…) réclame le serveur, sans code — comme Jellyfin ou Plex. Un autre appareil a
ensuite besoin du code pour reprendre la main. Ce que « directement » veut dire, et pourquoi :
[setup-security.md](setup-security.md).

## Quand l'assistant demande un code

De partout ailleurs — par Internet, derrière un mandataire qui transmet une adresse publique, par un nom de
domaine public, ou quand Tentacle ne voit pas votre vraie adresse (Docker Desktop, colima) — l'assistant
demande un code à usage unique, et dit où le lire. À chaque démarrage, tant que l'installation n'est pas
faite, Tentacle l'écrit dans **le journal de son conteneur** (ses « logs »). Lisez ce journal comme vous
gérez vos conteneurs :

| Vous utilisez | Où lire le code |
|---|---|
| **Portainer** | *Containers* → le conteneur Tentacle → **Logs** |
| un terminal (Docker, Podman) | `docker logs <conteneur>` (ou `podman logs <conteneur>`) |
| Docker Compose | `docker compose logs tentacle` depuis le dossier de la pile (`tentacle` est le nom du service dans les piles officielles ; mettez le vôtre si vous l'avez renommé) |
| Synology, Unraid, une autre interface | la page **Journal** / **Logs** du conteneur |

`<conteneur>` est le nom ou l'identifiant du conteneur (`docker ps` les liste). L'écran du code de
l'assistant affiche l'identifiant de ce conteneur et les commandes exactes, prêtes à copier. Le journal
contient un bloc comme :

```
  Tentacle — setup code / code d'installation : ABCD-EFGH-JKMN
  http://<this-server>:3000/setup#code=ABCD-EFGH-JKMN
```

Ouvrez le lien (remplacez `<this-server>` par l'adresse de la machine) : le code est déjà rempli. Il ne sert
qu'une fois, et il est aussi écrit dans `data/setup-token.txt` du volume de données. Perdu ou déjà utilisé ?
Tapez `tentacle setup token` dans la console du conteneur (Portainer : **Console** → *Connect* ; Synology,
Unraid : le terminal du conteneur), ou depuis un terminal :

```bash
docker exec <conteneur> tentacle setup token
```

## L'assistant, pas à pas

Une question par écran ; les étapes s'adaptent à la pile détectée.

1. **Bienvenue** — la langue, puis **Commencer**.
2. **Code d'installation** — seulement si l'assistant le demande (voir plus haut).
3. **Jellyfin** — la liste de **tous** les Jellyfin trouvés (découverte UDP de Jellyfin, puis la machine
   d'où l'assistant est ouvert et la passerelle du conteneur, sur les ports courants), rangés en **Neufs** et
   **Déjà configurés**, chacun avec son nom, son adresse, son port et sa version. Depuis un réseau Docker en
   pont, la découverte ne voit que cette machine : un Jellyfin sur un autre appareil se donne à la main.
   Cette étape n'est **jamais sautée**, même avec un seul Jellyfin, et **rien n'y est choisi pour vous** :
   un badge « Conseillé » montre celui que Tentacle propose, c'est vous qui cochez.
   - *tentacle-full* : le Jellyfin de la pile est **en tête** (« Dans cette pile »), conseillé. Il a été
     **verrouillé dès le démarrage** (personne d'autre ne peut le prendre) et se joint par son adresse
     interne. Les autres restent choisissables ; si vous en prenez un autre, celui de la pile reste
     verrouillé, sans servir ;
   - ailleurs, le neuf est conseillé ; prenez celui que vous voulez, ou donnez une adresse.

   Votre choix fixe la suite — **deux parcours**, que le serveur fait respecter (il refuse tout geste qui
   n'en fait pas partie, quoi que fasse le navigateur). Le Jellyfin choisi reste rappelé en tête de chaque
   écran (« Jellyfin “Salon” · déjà configuré »). Revenir à cette étape pour en choisir un autre recalcule
   le parcours ; ce qui avait été préparé pour l'autre est oublié (un compte déjà créé sur un Jellyfin y
   reste).
4. **Jellyfin neuf — votre compte administrateur** : vous le créez (il l'est aussi de Tentacle), avec la
   langue et le pays des métadonnées (proposés d'après le navigateur).
   **Jellyfin déjà configuré — connexion** : vous vous connectez avec un compte administrateur qui EXISTE
   (Tentacle crée sa clé d'API lui-même). Aucun compte n'est créé, ni ici, ni plus tard.
5. **Jellyfin neuf — bibliothèques** : de vraies bibliothèques Jellyfin, créées dans Jellyfin. *tentacle-full*
   propose **Films** (`/media/films`) et **Séries** (`/media/series`) ; parcourez les dossiers de Jellyfin
   pour en ajouter. Ce sont les chemins **de Jellyfin**, lus par son API : Tentacle n'a aucun réglage des
   médias, dans aucune pile.
   **Jellyfin déjà configuré — réglages conseillés** (aucun écran de bibliothèques) — Tentacle n'y crée **aucune**
   bibliothèque ; il rappelle celles qui existent et propose, tous **facultatifs** et décochables, les
   réglages que le tableau de bord conseille aussi : la détection des passages (Intro Skipper, TheIntroDB,
   SkipMe.db), la langue des métadonnées, les aperçus de la barre de lecture, la surveillance en temps
   réel, l'encodage HEVC (seulement avec un encodeur matériel). Chacun montre « actuellement → conseillé » ;
   ce que vous avez réglé autrement n'est jamais coché d'office. Seul ce qui est coché est appliqué ;
   **Passer** ne change rien.
6. **Récapitulatif**, avec **l'adresse de Jellyfin pour les applications** (lecture directe à la maison) :
   construite avec l'adresse par laquelle vous avez ouvert l'assistant et le port publié de Jellyfin
   (`JELLYFIN_PORT`), jamais un nom Docker. Modifiez-la au besoin. Puis **installation** (chaque étape ratée
   se relance seule).
7. **Accès à distance** (facultatif) — le HTTPS par votre propre mandataire : voir [remote-access.md](remote-access.md).
8. **Et maintenant ?** — où déposer vos fichiers, les applications de chaque plateforme, un QR code pour
    ouvrir le serveur.

## Réglages (`.env`)

Copiez `.env.example` en `.env` à côté de `compose.yaml`, décommentez ce qu'il faut, puis `docker compose up -d`.

| Variable | Défaut | |
|---|---|---|
| `MEDIA_PATH` | `./media` | *full* : votre dossier des médias sur cette machine. Seul Jellyfin le monte (il le voit en `/media`) ; `films` et `series` y sont créés au premier démarrage s'ils manquent (service `jellyfin-init`) |
| `TENTACLE_PORT` | `3000` | le port de Tentacle sur cette machine |
| `JELLYFIN_PORT` | `8096` | *full* : le port de Jellyfin sur cette machine |
| `JELLYFIN_DISCOVERY_PORT` | `7359` | *full* : le port UDP de découverte de Jellyfin (à changer si un autre Jellyfin tourne ici) |
| `PUID` / `PGID` | `1000` | le compte propriétaire de vos fichiers (`id -u`, `id -g`) |
| `TZ` | `Europe/Paris` | le fuseau horaire |
| `TENTACLE_VERSION` | `latest` | une version figée (ex. `v1.23.0`) pour ne mettre à jour que quand vous le décidez |

Variables du serveur, à poser dans `compose.yaml` (`environment:`) pour les cas particuliers :

| Variable | |
|---|---|
| `DATABASE_URL` ou `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` / `DB_PASSWORD_FILE` | **avant la 1.25 seulement** : l'ancienne base MariaDB/MySQL, que le serveur ne fait que LIRE pour la migrer ([sqlite-migration.md](sqlite-migration.md)). À retirer une fois que le tableau de bord dit « MariaDB n'est plus nécessaire » |
| `TENTACLE_PUBLIC_URL` | lien public de repli (celui réglé dans l'administration l'emporte) |
| `TRUSTED_PROXIES` | mandataires de plus dont `X-Forwarded-For` est cru (IP ou CIDR, séparés par des virgules) — voir [remote-access.md](remote-access.md#mandataires-de-confiance) |
| `REMOTE_CHECK_URL` | le service de test d'ouverture et la détection de l'adresse publique (`off` coupe les deux) |
| `TENTACLE_WEB_UI` | `off` coupe l'interface web — voir plus bas |

## Base de données

Tentacle garde tout (réglages, données des comptes, statistiques, données des extensions) dans
`data/tentacle.db`, un fichier SQLite de son volume de données (`tentacle-data` dans les piles, monté sur
`/app/apps/backend/data`). Rien à configurer. La carte *Services › Base de données* de l'administration en dit
le moteur, le fichier, la taille et l'état.

- **Sauvegarder** : copier le fichier — voir [operations.md](operations.md#sauvegarder).
- **Gardez le dossier de données sur un disque local.** Sur un partage réseau (NFS, SMB/CIFS…), SQLite peut
  s'abîmer : Tentacle le détecte et prévient, au journal et sur la carte *Base de données*, sans bloquer.
- **La lire** depuis la console du conteneur, en lecture seule : `tentacle db query "SELECT key FROM server_config"`.

## Désactiver l'interface web

Vous n'utilisez que les applications (bureau, mobile, TV) ? Posez `TENTACLE_WEB_UI: "off"` dans `environment:` du
service `tentacle` (la ligne y est déjà, en commentaire), puis redémarrez le conteneur. Le client web (`/`, ses
pages et ses fichiers) répond alors 404. Ce qui continue : l'API et ses sockets (`/api/…`, donc toutes les
applications), le client des TV LG sous `/tv` (une application à part entière, servie par ce serveur),
`/.well-known/` (le test d'ouverture) — et **l'assistant d'installation, tant que l'installation n'est pas
finie** : posée avant la fin, l'option ne ferme le web qu'après.

Pour revenir en arrière : remettez `"on"` et redémarrez, ou tapez `tentacle web on` dans la console du conteneur
(Portainer : **Console** → *Connect* ; ou `docker exec <conteneur> tentacle web on`) — effet sous cinq secondes,
sans redémarrage. La commande l'emporte sur la variable ; `tentacle web default` suit de nouveau la variable,
`tentacle web status` dit l'état et d'où il vient. Pas d'interrupteur dans l'administration : elle *est*
l'interface web, la couper de là vous enfermerait dehors.

## Podman

Les piles marchent avec `podman compose` (ou `podman-compose`). Le volume des médias porte `:z` pour SELinux.
Sans root : ajoutez `userns_mode: keep-id` aux services `jellyfin` et `tentacle` pour que les fichiers restent
à vous. Sans root, deux choses changent par rapport à Docker :

- **L'assistant demande toujours son code** : le relais de ports de Podman (rootlessport) cache l'adresse de
  votre navigateur, Tentacle ne distingue plus la maison d'Internet ([setup-security.md](setup-security.md)).
- **Un Jellyfin sur la même machine** (pile `tentacle-only`) reste `http://host.docker.internal:8096`. Podman
  fait mener ce nom à `169.254.1.2`, une adresse de lien local que l'assistant refuse d'ordinaire (les clouds y
  rangent leurs métadonnées) ; elle est acceptée sous ce nom seulement, parce que Podman l'a écrite dans le
  `/etc/hosts` du conteneur. Taper `169.254.1.2` elle-même est refusé.

Transcodage matériel avec Podman : voir [gpu.md](gpu.md#podman).

## Sans Docker

Tentacle tourne aussi en natif (`node apps/backend/dist/index.js` depuis une compilation). Sans Jellyfin sur
la machine, l'assistant donne la commande officielle d'installation de Jellyfin (Debian/Ubuntu) ou son guide
officiel, puis attend que Jellyfin réponde sur `http://127.0.0.1:8096`. Les piles Docker restent la voie
prise en charge.
