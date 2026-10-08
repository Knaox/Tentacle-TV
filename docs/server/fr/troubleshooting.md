# Dépannage

*English version: [../troubleshooting.md](../troubleshooting.md).*

| Symptôme | Remède |
|---|---|
| « Ce code n'est pas le bon, ou il a déjà servi » | Un code ne sert qu'une fois. Le journal du conteneur Tentacle (Portainer : *Logs* ; `docker logs <conteneur>`) montre celui en vigueur ; `tentacle setup token` dans sa console (`docker exec <conteneur> tentacle setup token`) en donne un neuf. |
| « Trop d'essais » | Cinq codes par minute et par adresse, et un code neuf après dix faux (pour tout le monde) : patientez une minute, lisez le nouveau code dans les journaux. |
| L'assistant dit l'installation déjà faite | Il est fermé pour de bon. Rouvrez-le depuis la machine : [operations.md](operations.md#rouvrir-lassistant-dinstallation). |
| « Dans Docker, localhost désigne Tentacle lui-même » | Donnez la vraie adresse de Jellyfin : `http://host.docker.internal:8096` (Jellyfin sur la même machine) ou `http://192.168.x.y:8096`. |
| « Personne ne répond à cette adresse » | Jellyfin est-il démarré ? Le port est-il juste ? Depuis un conteneur, un pare-feu de l'hôte peut bloquer. |
| « Cette version de Jellyfin n'est pas prise en charge » | Mettez Jellyfin à jour (10.10 au moins ; 10.11 et 12 sont testés). |
| « Migration de la base de données en cours » reste affiché | La 1.25 recopie l'ancienne base MariaDB : quelques secondes à quelques minutes. L'écran montre l'avancement et revient de lui-même. Détails : [sqlite-migration.md](sqlite-migration.md). |
| « La migration n'a pas abouti » | Vos données sont intactes (MariaDB n'est que lue). L'écran dit pourquoi ; les lignes `[db-migration]` du journal disent quoi exactement. Corrigez, puis relancez tout de suite par `tentacle db migrate` (ou attendez le nouvel essai automatique). Revenir à l'image d'avant marche toujours : [sqlite-migration.md](sqlite-migration.md#revenir-en-arrière). |
| « Cette installation utilisait une base MariaDB qui n'est plus configurée » | La pile a perdu son service `db` ou ses variables `DB_*` avant la migration : remettez-les le temps de la migration, puis redémarrez. Une pile Portainer déployée depuis le dépôt : pointez-la entre-temps sur l'étiquette `server-v1.24.0`. [sqlite-migration.md](sqlite-migration.md#mariadb-retirée-trop-tôt) |
| « La base est sur un partage réseau » | Sur NFS/SMB, SQLite peut s'abîmer : placez le dossier de données (`tentacle-data`) sur un disque local. |
| Bibliothèques : « Ce dossier n'existe pas pour Jellyfin » | Les chemins sont ceux **de Jellyfin** : dans un conteneur, votre dossier des médias est `/media`. |
| Test d'ouverture : « service indisponible » | Le service de test ne répond pas (ou `REMOTE_CHECK_URL=off`) : cela ne dit rien de votre installation. |
| Tout paraît « local » derrière Docker Desktop | Docker Desktop et colima cachent l'adresse des visiteurs : voir [remote-access.md](remote-access.md#mandataires-de-confiance). |
| La vidéo reste noire ou saccade en transcodage | Voir [gpu.md](gpu.md) ; vérifiez les réglages de transcodage de Jellyfin. |

Les journaux d'abord : celui du conteneur Tentacle (Portainer : *Logs* ; `docker logs --tail 200 <conteneur>` ; Compose : `docker compose logs --tail 200 tentacle`), puis celui de Jellyfin.
