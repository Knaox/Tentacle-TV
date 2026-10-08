# Serveur Tentacle — documentation

*English version: [../README.md](../README.md).*

> **Le guide pas à pas, captures à l'appui :** <https://tentacletv.app/docs/server/?lang=fr> — chaque écran
> de l'assistant d'installation y a sa page (le « Besoin d'aide ? » de l'assistant l'ouvre). Les pages
> ci-dessous servent de référence aux mainteneurs et aux installations avancées.

Tentacle est un serveur qu'on héberge soi-même, à côté de Jellyfin (ou avec lui). Deux piles Docker Compose
couvrent tous les cas ; un assistant guidé fait le reste dans le navigateur.

| Je veux… | Lire |
|---|---|
| installer Tentacle (et Jellyfin, si je n'en ai pas encore) | [install.md](install.md) |
| qui peut ouvrir l'assistant d'installation, et pourquoi (modèle de menace) | [setup-security.md](setup-security.md) |
| joindre mon serveur hors de chez moi, en HTTPS | [remote-access.md](remote-access.md) |
| le transcodage matériel (Intel, AMD, NVIDIA) | [gpu.md](gpu.md) |
| mettre à jour, sauvegarder, rouvrir l'assistant, migrer depuis l'ancien compose | [operations.md](operations.md) |
| ce que devient ma base MariaDB en 1.25, et comment la retirer ensuite | [sqlite-migration.md](sqlite-migration.md) |
| réparer ce qui ne marche pas | [troubleshooting.md](troubleshooting.md) |
| faire tourner le service de test d'ouverture (mainteneurs) | [port-check.md](port-check.md) |

## En une minute

```bash
mkdir tentacle && cd tentacle
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-full/compose.yaml
docker compose up -d
docker compose logs tentacle     # le code d'installation et le lien (Portainer : « Logs » du conteneur)
```

Portainer, un NAS, un autre nom de service ? Le code est dans **le journal du conteneur Tentacle**, où que
vous le lisiez ; l'écran du code de l'assistant affiche l'identifiant de ce conteneur et les commandes de
chaque cas.

Ouvrez `http://<cette-machine>:3000`, entrez le code et répondez aux questions de l'assistant, une à la fois :
Jellyfin est configuré pour vous, vos bibliothèques sont créées, et vous êtes connecté.

## Ce que les piles garantissent

- **Aucune base à installer, aucun secret à écrire.** Depuis la 1.25, Tentacle garde ses données dans un
  fichier SQLite de son volume de données (`data/tentacle.db`) ; une installation qui utilisait MariaDB est
  migrée d'elle-même ([sqlite-migration.md](sqlite-migration.md)).
- **Aucun réglage des médias pour Tentacle.** Seul Jellyfin monte votre dossier des médias ; Tentacle lit
  ses dossiers et ses bibliothèques par l'API de Jellyfin.
- **Jamais root, jamais le socket Docker.** Tentacle tourne sous `PUID:PGID` (1000:1000 par défaut) et ne
  monte pas `/var/run/docker.sock` : il ne pilote jamais Docker.
- **Un code d'installation à usage unique.** Tant que l'installation n'est pas faite, personne sur votre
  réseau ne peut revendiquer le serveur : l'assistant demande un code écrit dans les journaux. Une fois
  l'installation faite, l'assistant est fermé pour de bon (seule la commande `tentacle setup reset`, lancée
  sur la machine, le rouvre).
- **Podman marche aussi** (sans root compris) : voir [install.md](install.md#podman).
