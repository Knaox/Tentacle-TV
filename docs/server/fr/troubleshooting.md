# Dépannage

*English version: [../troubleshooting.md](../troubleshooting.md).*

| Symptôme | Remède |
|---|---|
| « Ce code n'est pas le bon, ou il a déjà servi » | Un code ne sert qu'une fois. `docker compose logs tentacle` montre celui en vigueur ; `docker compose exec tentacle tentacle setup token` en donne un neuf. |
| « Trop d'essais » | Cinq codes par minute et par adresse, et un code neuf après dix faux (pour tout le monde) : patientez une minute, lisez le nouveau code dans les journaux. |
| L'assistant dit l'installation déjà faite | Il est fermé pour de bon. Rouvrez-le depuis la machine : [operations.md](operations.md#rouvrir-lassistant-dinstallation). |
| « Dans Docker, localhost désigne Tentacle lui-même » | Donnez la vraie adresse de Jellyfin : `http://host.docker.internal:8096` (Jellyfin sur la même machine) ou `http://192.168.x.y:8096`. |
| « Personne ne répond à cette adresse » | Jellyfin est-il démarré ? Le port est-il juste ? Depuis un conteneur, un pare-feu de l'hôte peut bloquer. |
| « Cette version de Jellyfin n'est pas prise en charge » | Mettez Jellyfin à jour (10.10 au moins ; 10.11 et 12 sont testés). |
| « Cette base n'existe pas, ou ce compte n'y a pas accès » | Créez la base et donnez-lui ses droits (`GRANT ALL ON tentacle.* TO 'tentacle'@'%'`). |
| Bibliothèques : « Ce dossier n'existe pas pour Jellyfin » | Les chemins sont ceux **de Jellyfin** : dans un conteneur, votre dossier des médias est `/media`. |
| Test d'ouverture : « service indisponible » | Le service de test ne répond pas (ou `REMOTE_CHECK_URL=off`) : cela ne dit rien de votre installation. |
| Tout paraît « local » derrière Docker Desktop | Docker Desktop et colima cachent l'adresse des visiteurs : voir [remote-access.md](remote-access.md#mandataires-de-confiance). |
| La vidéo reste noire ou saccade en transcodage | Voir [gpu.md](gpu.md) ; vérifiez les réglages de transcodage de Jellyfin. |

Les journaux d'abord : `docker compose logs --tail 200 tentacle` (et `jellyfin`, `db`).
