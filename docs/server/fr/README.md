# Serveur Tentacle — documentation

*English version: [../README.md](../README.md).*

Tentacle est un serveur qu'on héberge soi-même, à côté de Jellyfin (ou avec lui). Trois piles Docker Compose
couvrent tous les cas ; un assistant guidé fait le reste dans le navigateur.

| Je veux… | Lire |
|---|---|
| installer Tentacle (et Jellyfin, si je n'en ai pas encore) | [install.md](install.md) |
| joindre mon serveur hors de chez moi, en HTTPS | [remote-access.md](remote-access.md) |
| le transcodage matériel (Intel, AMD, NVIDIA) | [gpu.md](gpu.md) |
| mettre à jour, sauvegarder, rouvrir l'assistant, migrer depuis l'ancien compose | [operations.md](operations.md) |
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

- **Aucun secret à écrire.** Les mots de passe de la base sont générés au premier démarrage (service `init`)
  et vivent dans un volume que seuls la base et Tentacle lisent.
- **Jamais root, jamais le socket Docker.** Tentacle tourne sous `PUID:PGID` (1000:1000 par défaut) et ne
  monte pas `/var/run/docker.sock` : il ne pilote jamais Docker.
- **Un code d'installation à usage unique.** Tant que l'installation n'est pas faite, personne sur votre
  réseau ne peut revendiquer le serveur : l'assistant demande un code écrit dans les journaux. Une fois
  l'installation faite, l'assistant est fermé pour de bon (seule la commande `tentacle setup reset`, lancée
  sur la machine, le rouvre).
- **Podman marche aussi** (sans root compris) : voir [install.md](install.md#podman).
