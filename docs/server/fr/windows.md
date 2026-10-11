# Tentacle Server pour Windows

*English version: [../windows.md](../windows.md).*

**Tentacle Server** est une app du Microsoft Store qui fait tourner le serveur Tentacle sur un PC Windows,
sans Docker. C'est le même serveur que l'image Docker (même code, même assistant d'installation, même
administration), dans une app qui vit dans la zone de notification, démarre avec votre session Windows et se
met à jour par le Store.

Il lui faut **Jellyfin**, le serveur multimédia gratuit, sur le même PC ou ailleurs sur votre réseau :
l'assistant d'installation le trouve, ou propose de l'installer depuis jellyfin.org avec votre accord.

> L'app a son propre numéro de version (à partir de 1.0.0) ; le serveur Tentacle qu'elle porte a le sien,
> affiché dans *Administration › Vue d'ensemble*. Les lignes marquées *(à confirmer)* décrivent un
> comportement pas encore éprouvé sur un paquet installé.

## Ce qu'il faut

| | |
|---|---|
| Windows | Windows 10 version 1809 ou plus récent, Windows 11 (x64). Windows Server : voir [plus bas](#windows-server-et-arm64) |
| Compte | n'importe quel compte Windows ; Tentacle lui-même n'exige aucun droit d'administrateur |
| Réseau | le réseau du PC en **Privé** (voir [Pare-feu et réseau](#pare-feu-et-réseau)) |
| Disque | environ 150 Mo pour l'app ; vos médias restent où ils sont |

## Installer depuis le Microsoft Store

Ouvrez le Microsoft Store, cherchez **Tentacle Server**, puis **Obtenir** (ou **Installer**). Depuis un
terminal :

```powershell
winget install --source msstore "Tentacle Server"
```

## Premier lancement

1. Ouvrez **Tentacle Server** depuis le menu Démarrer (le bouton **Ouvrir** du Store fait de même).
2. L'icône de Tentacle paraît dans la **zone de notification**, près de l'horloge. Windows peut la ranger sous
   la flèche **^** : faites-la glisser sur la barre des tâches pour la garder en vue.
3. Votre navigateur ouvre l'assistant d'installation **une seule fois**, sur l'adresse réseau de ce PC (par
   exemple `http://192.168.1.20:3000`, jamais `localhost`, pour que les adresses enregistrées pour vos
   téléphones et vos TV marchent). Depuis ce PC, aucun code n'est demandé : le premier navigateur de votre
   réseau domestique réclame le serveur ([setup-security.md](setup-security.md)).
4. Répondez aux questions de l'assistant : Jellyfin, votre compte, vos bibliothèques. Ensuite l'app démarre
   sans rien ouvrir ; **Ouvrir l'administration** dans le menu de l'icône (ou un double-clic sur l'icône) vous
   y ramène.

L'assistant ouvert depuis un autre réseau, ou après l'avoir fermé ? Il demande alors le code d'installation à
usage unique : **icône › Code d'installation** l'affiche (il est aussi dans le journal et dans
`setup-token.txt`).

## Le menu de l'icône

Clic droit sur l'icône de Tentacle. La première ligne dit l'état du serveur (*En marche, port 3000*, *Port
3000 déjà utilisé*…).

| Entrée | Ce qu'elle fait |
|---|---|
| **Ouvrir l'administration** | ouvre Tentacle dans votre navigateur (aussi un double-clic sur l'icône) |
| **Code d'installation** | affiche le code à usage unique, tant que l'installation n'est pas finie |
| **Démarrer avec Windows** | cochée : Tentacle démarre à l'ouverture de votre session Windows ([plus bas](#démarrer-avec-windows)) |
| **Changer de port** | liste des ports libres ; Tentacle redémarre sur celui choisi ([plus bas](#changer-de-port)) |
| **Ouvrir le journal** | ouvre le journal du jour |
| **Redémarrer le serveur** | présente quand le serveur est arrêté ou bloqué |
| **Supprimer les données du serveur…** | efface les données de Tentacle de ce PC, après confirmation ([plus bas](#vos-données)) |
| **Quitter** | arrête Tentacle. **Jellyfin continue de tourner** : c'est un programme à part |

Relancer Tentacle Server pendant qu'il tourne ne fait qu'ouvrir l'administration : jamais de second serveur.

## Démarrer avec Windows

L'app s'inscrit comme application de démarrage : après son premier lancement, Tentacle démarre **à chaque
ouverture de votre session Windows**, sans rien ouvrir. Il ne démarre **pas** quand le PC s'allume sans que
personne n'ouvre de session : une app du Store ne peut pas être un service Windows.

- Coupez-le ou rallumez-le par **Démarrer avec Windows** dans le menu de l'icône, ou dans **Paramètres ›
  Applications › Démarrage**. Coupé dans les Paramètres, l'app ne peut pas le rallumer seule : rallumez-le
  dans les Paramètres.
- **Après une mise à jour de Windows**, le PC redémarre et attend sur l'écran de connexion : le serveur reste
  éteint. Dans **Paramètres › Comptes › Options de connexion › Paramètres supplémentaires**, activez
  **« Utiliser mes informations de connexion pour terminer automatiquement la configuration après une mise à
  jour »** : Windows ouvre alors votre session après la mise à jour, et Tentacle démarre avec elle *(à
  confirmer sur un paquet installé)*.
- **Un PC dédié au serveur** (sans écran, dans un placard) : faites ouvrir la session par Windows au démarrage
  avec l'outil **Autologon** de Microsoft (Sysinternals, learn.microsoft.com/sysinternals/downloads/autologon).
  Il garde le mot de passe chiffré, jamais en clair. Quiconque a accès à la machine a alors votre session :
  réservez-le à une machine en lieu sûr, avec un compte qui ne sert qu'au serveur.
- **Empêchez la mise en veille** : **Paramètres › Système › Alimentation › Écran et veille**, *Lorsque
  branché, mettre l'appareil en veille après* : **Jamais**. Un PC en veille ne répond à aucune TV.

## Pare-feu et réseau

L'app déclare sa propre règle de pare-feu à l'installation : connexions entrantes vers **Tentacle
Server.exe** (TCP et UDP, tout port) sur les réseaux **Privé** et **Domaine**. Aucune invite du pare-feu, et
un port changé plus tard reste ouvert. Les réseaux **Public** restent fermés, exprès : Tentacle ne se montre
jamais sur le Wi-Fi d'un café.

Windows 11 classe souvent un nouveau réseau en **Public**. Tentacle affiche alors une notification, et
téléphones et TV ne le joignent pas. Passez le réseau en Privé : **Paramètres › Réseau et Internet › Wi-Fi**
(ou **Ethernet**) › votre réseau › **Type de profil réseau › Réseau privé**.

- **Le pare-feu de Jellyfin** : installé en mode simple, Jellyfin demande une fois, à son premier démarrage,
  quels réseaux autoriser : cochez **Privé**. Installé en service, il ne demande rien et reste fermé :
  autorisez-le dans **Sécurité Windows › Pare-feu et protection du réseau › Autoriser une application via le
  pare-feu**.
- **Donnez une adresse fixe au PC** dans votre box (réservation DHCP) : vos TV et la redirection de port de la
  box le retrouveront toujours.
- Depuis Internet, c'est comme avec Docker : [remote-access.md](remote-access.md).

## Changer de port

Tentacle écoute sur le port **3000**. Si un autre programme le prend déjà, l'icône dit *Port 3000 déjà
utilisé* et une notification l'explique. **Changer de port** liste les ports libres à cet instant ; choisissez
l'un d'eux et Tentacle redémarre dessus.

**Les TV et applications déjà jumelées doivent être jumelées à nouveau** (elles retiennent l'ancienne
adresse), et une redirection de port ou un mandataire inverse doit passer au nouveau port. Choisissez le port
avant de jumeler vos appareils.

## Vos données

Tout ce que Tentacle garde — base (`tentacle.db`), réglages, données des comptes, extensions, journaux — est
dans :

```
C:\ProgramData\Tentacle Server
```

`ProgramData` est un dossier caché : tapez `%ProgramData%\Tentacle Server` dans la barre d'adresse de
l'Explorateur. Seuls Windows (SYSTEM), les administrateurs du PC et le compte qui a installé Tentacle peuvent
le lire : la base contient des clés et des jetons. Si un autre compte Windows du PC lance l'app, elle dit que
Tentacle est déjà installé par un autre compte.

- **Désinstaller garde vos données.** Réinstallez l'app : le serveur revient tel qu'il était, assistant
  fermé. Le bouton **Réinitialiser** de *Paramètres › Applications* n'y touche pas non plus.
- **Pour les effacer**, choisissez **Supprimer les données du serveur…** dans le menu de l'icône (confirmation
  demandée) : Tentacle supprime le dossier, puis se ferme. Désinstallez ensuite l'app dans **Paramètres ›
  Applications › Applications installées** si vous le souhaitez. Jellyfin, ses données et vos films ne sont
  **jamais** touchés.
- **Sauvegardez** en copiant `tentacle.db` : **Quittez** d'abord Tentacle, copiez le fichier (ou tout le
  dossier), puis relancez-le depuis le menu Démarrer.
- **Laissez le dossier où il est.** Une base sur OneDrive ou un partage réseau peut se corrompre ; c'est pour
  cela que Tentacle n'utilise pas `Documents`.

## Mises à jour

Le Microsoft Store met l'app à jour, serveur compris. Mais le Store **ne met jamais à jour une app qui
tourne**, et Tentacle tourne toujours. L'app cherche donc une mise à jour chaque jour et l'installe elle-même à
un moment calme, quand personne ne regarde rien : elle arrête proprement le serveur, garde une copie de la base
dans `backups\` (les trois dernières sont gardées), installe la mise à jour et redémarre *(à confirmer : livré
avec le paquet)*. Rien à faire de votre côté.

*Administration › Vue d'ensemble* dit *Mise à jour par le Microsoft Store* au lieu de donner une commande
Docker. Si votre serveur est trop ancien pour une application, l'avertissement reste : ouvrez la
**Bibliothèque** du Store et cliquez sur **Obtenir les mises à jour**.

## Jellyfin

À l'étape **Jellyfin** de l'assistant, l'app cherche Jellyfin sur ce PC (les clés de registre de
l'installateur officiel, son port configuré, puis sa réponse) et liste tous les Jellyfin trouvés sur votre
réseau.

- **Jellyfin trouvé** : choisissez-le, comme sur toute installation. Installé mais arrêté : en mode simple,
  **Démarrer Jellyfin** le lance ; en service, démarrez *Jellyfin Server* dans l'app **Services** (Tentacle ne
  demande jamais de droits d'administrateur).
- **Pas de Jellyfin** : **Installer Jellyfin** télécharge l'installateur **officiel** depuis
  `repo.jellyfin.org` (la plus récente version stable éprouvée par Tentacle), vérifie son empreinte SHA-256 et
  sa taille, puis le lance **avec votre accord**. Windows demande l'accord d'un administrateur : c'est
  l'installateur de Jellyfin, pas Tentacle. Choisissez l'installation **simple** (pas le service), celle que
  Jellyfin recommande et qui voit vos lecteurs réseau. Revenez ensuite à l'assistant : Jellyfin est détecté.
- **Si le téléchargement, la vérification ou le lancement échoue** (le contrôle intelligent des applications
  peut bloquer l'installateur de Jellyfin, qui n'est pas signé), ou sur un PC ARM64 : l'assistant ouvre
  **jellyfin.org/downloads/windows** ; installez Jellyfin vous-même, l'assistant le détecte dès qu'il répond.

Tentacle ne met jamais Jellyfin à jour, ne l'arrête pas et ne le désinstalle pas : Jellyfin se met à jour par
son propre installateur.

## Bibliothèques : D:\Films et lecteurs réseau

C'est Jellyfin qui lit vos fichiers : les chemins s'écrivent **tels que Jellyfin les voit** : `D:\Films`,
`E:\Séries`.

- Assistant ouvert sur ce PC : **Parcourir avec l'Explorateur** ouvre le sélecteur de dossiers de Windows
  *(à confirmer : livré avec l'étape Jellyfin)*. Depuis un autre appareil, l'assistant parcourt les dossiers
  de Jellyfin.
- **Lecteurs réseau** : une lettre comme `Z:` n'existe que dans votre session ; Jellyfin (surtout en service)
  ne la voit pas. Écrivez le chemin réseau : `\\NAS\partage\Films`. Jellyfin installé en mode simple utilise
  votre compte et ses identifiants enregistrés ; en service, il tourne en *Service réseau*, et le partage doit
  autoriser le compte du PC.
- **Disques USB** : donnez au disque une lettre fixe dans la **Gestion des disques**, sinon elle peut changer
  d'un branchement à l'autre et la bibliothèque se vide.

## Journaux

**Ouvrir le journal** dans le menu de l'icône ouvre le fichier du jour :

```
C:\ProgramData\Tentacle Server\logs\server-AAAA-MM-JJ.log
```

Un fichier par jour, sept jours gardés. Il contient la sortie du serveur (les mêmes lignes que `docker logs`)
et les lignes de l'app elle-même, marquées `[hôte]`. Joignez-le quand vous demandez de l'aide.

## La commande `tentacle`

*(À confirmer : la commande n'est pas encore livrée.)* L'app ajoute une commande `tentacle` à Windows (un
alias d'exécution d'application), pour les rares cas que le menu ne couvre pas. Dans PowerShell ou le
Terminal Windows :

```powershell
tentacle setup token      # un nouveau code d'installation
tentacle setup reset      # rouvrir l'assistant d'installation
tentacle web status       # interface web allumée ou coupée (aussi : on, off, default)
```

Les mêmes commandes que dans l'image Docker ([operations.md](operations.md)). Si Windows dit que la commande
n'existe pas : **Paramètres › Applications › Paramètres d'applications avancés › Alias d'exécution
d'application**, activez *tentacle.exe*.

## Windows Server et ARM64

- **Windows Server** n'a pas de Microsoft Store. Sur Windows Server 2025 avec l'expérience de bureau,
  `winget install --source msstore "Tentacle Server"` marcherait d'après des retours d'utilisateurs, sans
  confirmation de Microsoft *(à confirmer)*. Rien n'est promis pour 2019 et 2022, ni pour Server Core (pas de
  zone de notification). Tentacle démarrant à l'ouverture de session, un serveur a besoin de l'ouverture de
  session automatique décrite [plus haut](#démarrer-avec-windows).
- **ARM64** (Windows sur Snapdragon…) : le paquet est x64 seulement *(à confirmer : la marche sous
  l'émulation x64 de Windows 11 n'est pas éprouvée)*. Jellyfin ne publie aucun installateur ARM64 :
  l'assistant renvoie toujours vers jellyfin.org.

## Limites de la première version

- Démarrage à l'ouverture de session, pas à l'allumage (voir plus haut).
- Pas d'*analyse audio* pour la détection des passages : elle exige ffmpeg, que l'app ne porte pas ; elle
  n'est proposée que si le ffmpeg de Jellyfin est trouvé sur le PC *(à confirmer)*. La détection par les
  trois greffons de Jellyfin marche.
- Le transcodage matériel est l'affaire de Jellyfin : **Jellyfin › Tableau de bord › Lecture › Transcodage**
  (Intel QSV, NVIDIA NVENC, AMD AMF). [gpu.md](gpu.md) vaut pour Docker.

## Dépannage

| Symptôme | Que faire |
|---|---|
| Pas d'icône après le lancement | regardez sous la flèche **^** de la zone de notification ; **Ouvrir le journal** est dans son menu |
| *Port 3000 déjà utilisé* | **Changer de port**, ou fermez le programme qui tient le port |
| *Le serveur s'arrête sans cesse* | **Ouvrir le journal**, lisez les dernières lignes, puis **Redémarrer le serveur** |
| Téléphones et TV ne trouvent pas le serveur | réseau en **Public** ? un VPN sur le PC ? Utilisez l'adresse qu'ouvre **Ouvrir l'administration** |
| *Données tenues par un autre serveur* | un autre Tentacle (ou un second compte) utilise le dossier : fermez-le, puis **Redémarrer le serveur** |
| Tout le reste | [troubleshooting.md](troubleshooting.md) |
