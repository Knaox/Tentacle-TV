# Erreurs du mobile et de la tablette — inventaire et présentation (lot du 20/10)

Demande de Damien : sur le téléphone et l'iPad, **chaque** erreur possible est dite à l'écran,
proprement, sans frustration — au moins aussi bien qu'au bureau. Ce document est l'inventaire
(une ligne par cause, tenue par `packages/shared/src/problems/problemInventory.test.ts`), la règle
de présentation, et l'API préparée pour le futur bouton « Signaler un problème ».

## Le modèle — une seule source

`packages/shared/src/problems/` (rien ne se recopie sur une plateforme) :

| Fichier | Rôle |
|---|---|
| `problemTypes.ts` | Contextes (QUOI), causes (POURQUOI), actions (QUOI FAIRE), icônes, `ProblemModel` |
| `problemCatalog.ts` + `problemCatalogMore.ts` | Une entrée par cause : icône, phrase, aide, actions dans l'ordre, gravité et forme imposées |
| `describeProblem.ts` | Cause + contexte + disponibilité → message (trois gestes au plus, ceux qui peuvent aboutir ICI) |
| `classifyProblem.ts`, `diagnose.ts`, `engineErrors.ts`, `fromError.ts` | Une erreur brute (HTTP, réseau, moteur) → une cause |
| `problemSources.ts` | Les codes des DOMAINES → une cause : `wtProblemCause`, `offlineTransferCause`, `pushProblemCause`, `signInProblemCause`, `accountAccessCause` |
| `problemPresentation.ts` | Gravité (`info` · `warning` · `error`), forme (`banner` · `card` · `screen`), code du support, `parseProblemCode` |
| `problemDiagnostics.ts`, `problemJournal.ts` | Le contexte de diagnostic sans secret, le journal local tournant |
| `i18n/locales/{fr,en}/errors.ts` + `errorsMore.ts` | Les phrases (espace `errors`) |

Un message = **titre** (le contexte : « La lecture n'a pas pu démarrer »), **raison** (la cause en
mots simples), **aide** (une phrase), **une à trois actions** (la première est la principale),
**détails** repliés (« Détails », « Copier ») et le **code du support** en petit
(« Code : playbackStart/transcodeFailed »). Jamais un message brut, une pile ou un code seul à la
place du message ; jamais « ce n'est pas votre faute » (tenu par le test) ; jamais
« téléchargement » (tenu par `errorsVocabulary.test.ts`).

### Les trois formes

| Forme | Quand | Composant mobile |
|---|---|---|
| **Bandeau** (`banner`) | Non bloquant : un geste défait, un constat de séance, un transfert, les notifications. S'efface seul (6 s, suspendu au doigt et au lecteur d'écran), se chasse d'un glissé. | `showProblemBanner(model, { onAction?, title? })` (`src/problems/problemBanner.ts`) → `NoticeHost` |
| **Carte dans le lecteur** (`card`) | Une erreur de lecture, de diffusion, une désynchronisation : sur l'image du titre, avec ses actions. | `PlaybackProblemView` → `ProblemPanel tone="player"` |
| **Écran plein** (`screen`) | Impossible de continuer ici : page qui ne charge pas, compte refusé, écran qui plante. | `ProblemState` (la pieuvre) → `ProblemPanel tone="page"` |

La forme vient de la cause quand elle l'impose (« Léa a quitté la séance » reste un bandeau même
dans le lecteur ; « compte désactivé » est un écran plein partout), sinon du contexte
(`problemPresentation`). L'appelant peut l'imposer (`describeProblem({ presentation })`).

### Aucune erreur en silence, aucun écran blanc

- **Chaque écran** des piles et des onglets a sa limite d'erreur (`ScreenErrorBoundary`, posée par
  `screenLayout={withScreenBoundary}` dans `app/_layout.tsx`, `app/(auth)/_layout.tsx`,
  `app/(tabs)/_layout.tsx`) : un écran qui plante cède la place à « Cet écran n'a pas pu s'afficher »
  (Réessayer · Retour) ; la barre d'onglets et le reste de la pile continuent.
- La **racine** (`providers/ErrorBoundary.tsx`) dit la même chose, avec le code, si tout tombe.
- Une **erreur JavaScript non attrapée** entre au journal (`ProblemJournalBinding`), puis suit son
  chemin habituel.
- Les **gestes** étiquetés (`meta.failureTitle`) qui échouent deviennent un bandeau (`MutationFailureBinding`).
- La **connexion** lit le corps du refus : compte désactivé, bloqué, hors des heures d'accès, trop
  d'appareils, trop d'essais, migration de la base (`src/problems/signInMessage.ts`).

### Codes déjà dits par leur propre espace (pas dupliqués ici)

- **Famille** (`family.*`, 39 codes de `FAMILY_ERROR_STATUS`) : `familyErrorOf` + l'espace `family`
  (`familyLabels.ts`), rendus par les écrans de la Famille. `family.pin_invalid` (essais restants),
  `family.pin_locked` (fin du blocage), `family.invite_*` (délais) portent leurs valeurs.
- **Assistant d'installation** (`SetupErrorCode`) : espace `setupWizardErrors` — le mobile n'installe pas de serveur.
- **Inscription** (`RegisterRefusalCode`) : la phrase du serveur, gardée telle quelle (`RegisterScreen`).
- **Plus de serveur** (`connectivityCase`) : trois cas, mêmes mots partout ; le mobile passe en mode
  hors ligne et le dit par un message temporaire, jamais un voile.
- **Panne de Jellyfin** (`outageView`, `useOutageGate`) : bandeau du lecteur, aucune erreur pendant la
  panne, flux rouvert au retour.
- **Migration de la base** (`decideMigrationScreen`, `useDatabaseMigrationGate`) : son écran d'attente.
- **Droits de lecture du compte** (`playbackRefusal`) : `playbackNotAllowed`, `transcodeNotAllowed` ci-dessous.

## Inventaire — une ligne par cause

Les actions listées sont celles offertes quand TOUT est possible ; `describeProblem` n'offre que ce
qui peut aboutir ici (« Autre version » seulement s'il y en a une, « Ouvrir les réglages » seulement
si la plateforme sait le faire…), trois au plus. Le code du support est `<contexte>/<cause>`.
« Forme imposée » : `contexte` = la forme suit le contexte (lecture → carte, page → écran, geste → bandeau).
Les lignes marquées **branchement : <session>** ont leur cause et leurs phrases prêtes ; l'écran
qui la montre appartient à une autre session du lot (voir « Branchements à faire »).

### Joindre le serveur

| Cause (code) | Source brute | Message FR (raison + aide) | Message EN (raison) | Actions proposées | Gravité | Forme imposée | Où sur le mobile |
|---|---|---|---|---|---|---|---|
| `deviceOffline` | NetInfo hors ligne, sonde `network` | Cet appareil n'est connecté à aucun réseau. Vérifiez le Wi-Fi ou les données mobiles, puis réessayez. | This device isn't connected to any network. | Réessayer · Titres hors ligne · Retour | warning | contexte | Écran de page · carte du lecteur · bascule hors ligne (message temporaire `useConnectivityNotice`) |
| `serverUnreachable` | `TypeError` réseau, 502/503/504 du serveur, sonde `backend` | Le serveur Tentacle ne répond pas. Il est peut-être arrêté ou en train de redémarrer. Si cela dure, prévenez son administrateur. | The Tentacle server isn't responding. | Réessayer · Retour | warning | contexte | Écran de page · carte du lecteur · bandeau d'un geste · bascule hors ligne |
| `serverTimeout` | `AbortError`/délai, 408, sonde `timeout` | Le serveur Tentacle met trop de temps à répondre. Il est peut-être très occupé, ou la connexion est très lente. | The Tentacle server is taking too long to respond. | Réessayer · Qualité réduite · Retour | warning | contexte | Écran de page · carte du lecteur |
| `certificate` | erreur TLS (« certificate », « SSL ») | Cet appareil ne reconnaît pas le certificat de sécurité (HTTPS) du serveur. Il a peut-être expiré, ou il est auto-signé. Vérifiez l'adresse, ou demandez à l'administrateur de renouveler le certificat. | This device doesn't trust the server's security certificate (HTTPS). | Réessayer · Retour | error | contexte | Écran de connexion au serveur (`ServerSetupScreen`) |
| `insecureBlocked` | ATS iOS / cleartext Android | Cet appareil refuse les connexions non chiffrées (HTTP) vers cette adresse. Utilisez l'adresse HTTPS du serveur. | This device blocks unencrypted (HTTP) connections to this address. | Retour | error | contexte | Écran de connexion au serveur |
| `notTentacle` | 404 de `/api/health` | Cette adresse répond, mais ce n'est pas un serveur Tentacle. Vérifiez l'adresse : elle doit mener au serveur Tentacle, pas directement à Jellyfin. | This address responds, but it isn't a Tentacle server. | Réessayer · Retour | error | contexte | Écran de connexion au serveur |
| `serverError` | 5xx du serveur Tentacle | Le serveur Tentacle a rencontré une erreur. Réessayez dans un instant. Si cela se répète, les détails aideront l'administrateur. | The Tentacle server ran into an error. | Réessayer · Retour | error | contexte | Écran de page · bandeau d'un geste |
| `serverTooOld` | 404 d'une route `/api/…` ; `serverUpdate` bloquant sous `minServer` | Votre serveur Tentacle est trop ancien pour cette fonction. Elle fonctionnera quand l'administrateur l'aura mis à jour. | Your Tentacle server is too old for this feature. | Retour | error | contexte | Écran de page ; avertissement « Serveur à mettre à jour » (`NoticeHost`) |
| `jellyfinUnreachable` | 502/503 par le relais, sonde `jellyfin`, `server:jellyfin` (panne) | Jellyfin, qui fournit les vidéos, ne répond pas. Il redémarre peut-être : réessayez dans un instant. | Jellyfin, which provides the videos, isn't responding. | Réessayer · Retour | warning | contexte | Écran de page · carte du lecteur · bandeau de panne `outageView` (aucune erreur pendant la panne, reprise au retour) |
| `jellyfinError` | 5xx de Jellyfin | Jellyfin a rencontré une erreur. Réessayez dans un instant. Si cela se répète, les détails aideront l'administrateur. | Jellyfin ran into an error. | Réessayer · Autre version · Retour | error | contexte | Écran de page · carte du lecteur |

### Le compte et la connexion

| Cause (code) | Source brute | Message FR (raison + aide) | Message EN (raison) | Actions proposées | Gravité | Forme imposée | Où sur le mobile |
|---|---|---|---|---|---|---|---|
| `sessionExpired` | 401 | Votre session a expiré. Reconnectez-vous pour continuer. | Your session has expired. | Se reconnecter · Retour | error | contexte | Écran de page (→ Se reconnecter) · carte du lecteur |
| `notAllowed` | 403, `NotAllowed` de PlaybackInfo | Votre compte n'a pas l'autorisation de faire ceci. Demandez à l'administrateur du serveur. | Your account isn't allowed to do this. | Retour | error | contexte | Écran de page · carte du lecteur · bandeau d'un geste |
| `playbackNotAllowed` | 403 `{ code: playback_not_allowed }` | La lecture n'est pas autorisée pour ce compte. L'administrateur peut l'autoriser dans Jellyfin, dans les droits de lecture de votre compte. | Playback isn't allowed for this account. | Retour | error | contexte | Carte du lecteur |
| `wrongCredentials` | 401/400 de `/api/auth/login` | Le nom d'utilisateur ou le mot de passe ne correspond pas. Vérifiez les majuscules, puis réessayez. | The username or password doesn't match. | Réessayer | warning | banner | Sous le formulaire de connexion (`LoginScreen`) |
| `accountDisabled` | 403 `{ code: account_disabled }` ; `account_access` `disabled` | Ce compte a été désactivé par l'administrateur du serveur. L'administrateur du serveur peut le réactiver. | This account was disabled by the server's administrator. | Retour | error | screen | Sous le formulaire de connexion ; écran plein en session |
| `accountLockedOut` | 403 `account_locked_out` ; `account_access` `lockedOut` | Ce compte est bloqué après trop d'essais. L'administrateur du serveur peut le réactiver. | This account is locked after too many attempts. | Retour | error | screen | Sous le formulaire de connexion ; écran plein en session |
| `accountOutsideSchedule` | 403 `account_outside_schedule` ; `account_access` `outsideSchedule` | Ce compte ne peut pas se connecter à cette heure-ci. L'administrateur a fixé ses heures d'accès. | This account can't sign in at this time of day. | Retour | error | screen | Sous le formulaire de connexion ; écran « accès suspendu » (`accountAccess`) |
| `accountMaxSessions` | 403 `account_max_sessions` | Ce compte est déjà connecté sur le nombre maximal d'appareils. Déconnectez un autre appareil, puis réessayez. | This account is already signed in on the maximum number of devices. | Réessayer · Retour | error | screen | Sous le formulaire de connexion |
| `tooManyAttempts` | 429 de la connexion | Trop d'essais d'affilée. Patientez une minute, puis réessayez. | Too many attempts in a row. | Réessayer | warning | banner | Sous le formulaire de connexion |
| `databaseMigrating` | 503 `{ state: migrating }` | Le serveur Tentacle met à jour sa base de données. Cela prend quelques minutes ; l'app reprendra d'elle-même. | The Tentacle server is updating its database. | Réessayer | info | screen | Écran d'attente de la migration (`useDatabaseMigrationGate`, sa propre vue) ; sous le formulaire si la connexion tombe dessus |

### Famille et droits

| Cause (code) | Source brute | Message FR (raison + aide) | Message EN (raison) | Actions proposées | Gravité | Forme imposée | Où sur le mobile |
|---|---|---|---|---|---|---|---|
| `profileSessionExpired` | session de profil (Famille) close ; `family.pairing_required` sur un profil | La session de ce profil a pris fin sur cet appareil. Choisissez de nouveau votre profil pour continuer. | This profile's session ended on this device. | Changer de profil · Retour | error | screen | Écran plein (→ Changer de profil) — **branchement : famille-mobile** |
| `parentalBlocked` | titre masqué par le contrôle parental du profil | Ce titre n'est pas autorisé pour ce profil. Le contrôle parental de la famille le masque. Le propriétaire de la famille peut changer cette règle. | This title isn't allowed for this profile. | Retour · Changer de profil | error | contexte | Carte du lecteur / page — **branchement : droits-mobile** |

### La lecture

| Cause (code) | Source brute | Message FR (raison + aide) | Message EN (raison) | Actions proposées | Gravité | Forme imposée | Où sur le mobile |
|---|---|---|---|---|---|---|---|
| `itemNotFound` | 404 de Jellyfin | Ce titre n'est plus dans la bibliothèque. Il a peut-être été retiré ou déplacé. | This title is no longer in the library. | Retour | error | contexte | Écran de page (fiche) · carte du lecteur |
| `fileMissing` | 404 du flux, sonde du fichier source 404, `noMediaSource` | Le fichier vidéo est introuvable sur le serveur. Il a peut-être été déplacé ou supprimé. L'administrateur peut relancer l'analyse de la bibliothèque. | The video file can't be found on the server. | Autre version · Réessayer · Retour | error | contexte | Carte du lecteur |
| `noCompatibleStream` | `NoCompatibleStream` | Cet appareil ne sait pas lire ce format, et le serveur ne peut pas le convertir. Essayez une autre version du titre, ou prévenez l'administrateur. | This device can't play this format, and the server can't convert it. | Autre version · Retour | error | contexte | Carte du lecteur |
| `transcodeNotAllowed` | `NoCompatibleStream` + transcodage interdit ; 403 `conversion_not_allowed` | Ce titre doit être converti pour être lu sur cet appareil, et votre compte ne le permet pas. L'administrateur peut l'autoriser dans Jellyfin, dans les droits de lecture de votre compte. | This title must be converted to play on this device, and your account doesn't allow it. | Autre version · Retour | error | contexte | Carte du lecteur |
| `transcodeFailed` | 5xx d'un segment converti | Le serveur n'a pas réussi à convertir cette vidéo pour cet appareil. Une qualité réduite lui demande moins de travail. | The server couldn't convert this video for this device. | Qualité réduite · Réessayer · Autre version | error | contexte | Carte du lecteur |
| `subtitleBurnFailed` | échec avec incrustation de sous-titres | Le serveur n'a pas pu incruster ces sous-titres dans l'image. Regardez sans sous-titres, ou choisissez-en d'autres. | The server couldn't burn these subtitles into the picture. | Sans sous-titres · Réessayer · Retour | error | contexte | Carte du lecteur |
| `tooManyStreams` | `RateLimitExceeded`, 429 du flux | Trop de lectures sont déjà en cours sur ce serveur ou ce compte. Arrêtez une autre lecture, puis réessayez. | Too many streams are already playing on this server or account. | Réessayer · Retour | error | contexte | Carte du lecteur |
| `connectionLost` | réseau perdu après la première image | La connexion au serveur a été perdue. Vérifiez le réseau, puis réessayez. | The connection to the server was lost. | Réessayer · Retour | warning | contexte | Carte du lecteur (reprise à la même position) |
| `bandwidthTooLow` | `startTimeout` d'un flux direct qui répond, débit mesuré | La connexion est trop lente pour cette qualité : {{measured}} Mb/s mesurés, il en faut {{needed}}. Une qualité réduite demande moins au réseau. | The connection is too slow for this quality: {{measured}} Mb/s measured, {{needed}} needed. | Qualité réduite · Réessayer · Retour | error | contexte | Carte du lecteur ; « La vidéo se fait attendre » (calage, non bloquant) |
| `startTimeout` | marqueur `startTimeout` | La vidéo n'est pas arrivée à temps. Le serveur est peut-être très occupé à la convertir. Réessayez, ou choisissez une qualité réduite. | The video didn't arrive in time. | Réessayer · Qualité réduite · Retour | error | contexte | Carte du lecteur |
| `seekTimeout` | marqueur `seekTimeout` | Le serveur n'a pas ramené la vidéo à ce passage. Il convertit la vidéo depuis ce nouveau point et n'a pas suivi. Réessayez : la lecture reprendra à ce passage. | The server didn't bring the video back at this point. | Réessayer · Qualité réduite · Retour | error | contexte | Carte du lecteur |
| `decodeFailed` | erreur de décodage du moteur (mpv, AVPlayer, ExoPlayer) | Cet appareil n'a pas réussi à décoder cette vidéo. Une qualité réduite la fait convertir dans un format plus simple. | This device couldn't decode this video. | Qualité réduite · Autre version · Retour | error | contexte | Carte du lecteur |
| `engineFailed` | le moteur ne démarre pas | Le lecteur vidéo de l'application n'a pas pu démarrer. Réessayez ; si cela se répète, redémarrez l'application. | The app's video player couldn't start. | Réessayer · Retour | error | contexte | Carte du lecteur |

### Watch Together

| Cause (code) | Source brute | Message FR (raison + aide) | Message EN (raison) | Actions proposées | Gravité | Forme imposée | Où sur le mobile |
|---|---|---|---|---|---|---|---|
| `wtJoinFailed` | échec REST de `join`/`respond`, socket fermée en rejoignant | Impossible de rejoindre la séance. La connexion au serveur a peut-être été coupée. Réessayez dans un instant. | Couldn't join the session. | Rejoindre de nouveau · OK | warning | banner | Bandeau (→ Rejoindre de nouveau) — **branchement : wt-mobile** |
| `wtMemberLeft` | `wt:state` (membre en moins, `wtStateEffects`) | Léa a quitté la séance. | Léa left the session. | — | info | banner | Bandeau info, sans geste — **wt-mobile** |
| `wtMemberDisconnected` | `wt:goodbye` / grâce de déconnexion | Léa a perdu sa connexion. La séance l'attend un instant. | Léa lost their connection. | — | info | banner | Bandeau info — **wt-mobile** |
| `wtRoomClosed` | `wt:dissolved` `expired`/`dissolved`, `wt:error not_in_group`, REST `group_gone`/`not_member`/`not_elsewhere` | La séance est terminée. Vous pouvez continuer à regarder seul. | The session has ended. | OK | info | banner | Bandeau — **wt-mobile** |
| `wtRemoved` | `wt:dissolved kicked` | Vous avez été retiré de la séance. | You were removed from the session. | OK | warning | banner | Bandeau — **wt-mobile** |
| `wtInviteExpired` | REST `invite_gone` | Cette invitation n'est plus valable. La séance est peut-être terminée. Demandez une nouvelle invitation. | This invitation is no longer valid. | OK | warning | banner | Bandeau — **wt-mobile** |
| `wtAccessRevoked` | `wt:dissolved access_revoked`, REST `access_denied` | Ce compte n'a plus accès à Watch Together. Demandez à l'administrateur du serveur. | This account no longer has access to Watch Together. | OK | error | banner | Bandeau — **wt-mobile** |
| `wtAlreadyInGroup` | REST `already_in_group` | Vous êtes déjà dans une autre séance. Quittez-la d'abord pour rejoindre celle-ci. | You're already in another session. | OK | warning | banner | Bandeau — **wt-mobile** |
| `wtHostOnly` | `wt:error not_host`, REST `not_host` | Seul l'hôte de la séance peut faire cela. | Only the session's host can do this. | OK | info | banner | Bandeau info — **wt-mobile** |
| `wtTitleUnavailable` | REST `unknown_title` | Ce titre n'est pas disponible pour tout le monde dans la séance. Choisissez-en un que chaque membre peut regarder. | This title isn't available to everyone in the session. | OK | warning | banner | Bandeau — **wt-mobile** |
| `wtDesync` | `wt:error stale_item`, dérive irrécupérable (`decideDrift`) | Cet appareil n'arrive plus à suivre la séance. Rejoignez-la de nouveau : la lecture se recalera sur les autres. | This device can't keep up with the session anymore. | Rejoindre de nouveau · Retour | error | card | Carte du lecteur (→ Rejoindre de nouveau) — **wt-mobile** |

### Hors ligne

| Cause (code) | Source brute | Message FR (raison + aide) | Message EN (raison) | Actions proposées | Gravité | Forme imposée | Où sur le mobile |
|---|---|---|---|---|---|---|---|
| `offlineMode` | mode hors ligne, titre absent de l'appareil | Le mode hors ligne est activé, et ce titre n'est pas sur cet appareil. Repassez en ligne pour le regarder depuis le serveur. | Offline mode is on, and this title isn't on this device. | Repasser en ligne · Titres hors ligne · Retour | error | contexte | Carte du lecteur / page |
| `offlineFileMissing` | lecture locale, fichier absent ; `errorCode=missing` | Le fichier gardé hors ligne n'est plus sur cet appareil. Regardez-le en ligne, ou gardez-le de nouveau hors ligne. | The offline copy is no longer on this device. | Regarder en ligne · Retour | error | contexte | Carte du lecteur local · badge de la ligne hors ligne |
| `offlineFileDamaged` | lecture locale, fichier incomplet ; `errorCode=integrity` | Le fichier gardé hors ligne est incomplet ou abîmé. Regardez-le en ligne, ou gardez-le de nouveau hors ligne. | The offline copy is incomplete or damaged. | Regarder en ligne · Retour | error | contexte | Carte du lecteur local · badge de la ligne hors ligne |
| `transferFailed` | `errorCode` `io`, `network`, `finalize`, `audio`, `unexpected` | Le transfert vers cet appareil s'est interrompu. Réessayez : il reprendra là où il s'est arrêté. | The transfer to this device was interrupted. | Réessayer · Gérer les titres hors ligne | error | banner | Badge de la ligne (`OfflineStatusBadge`) ; bandeau à l'échec — **branchement : hors-ligne-live** |
| `storageFull` | `errorCode=disk-full` | Il n'y a plus assez d'espace sur cet appareil. Retirez des titres gardés hors ligne, ou libérez de l'espace, puis réessayez. | There isn't enough space left on this device. | Gérer les titres hors ligne · OK | error | banner | Badge de la ligne ; notification locale (`OfflineReadyNotifier`) ; bandeau (→ Gérer les titres hors ligne) |
| `wifiRequired` | `transferWait = wifi` | Le transfert attend le Wi-Fi. Vos réglages le réservent au Wi-Fi : il repartira seul dès que vous serez connecté. | The transfer is waiting for Wi-Fi. | Gérer les titres hors ligne · OK | info | banner | Badge « En attente du Wi-Fi » ; bandeau info |
| `transferSourceGone` | `errorCode=unavailable` | Ce titre n'est plus disponible sur le serveur. Il a peut-être été retiré de la bibliothèque. | This title is no longer available on the server. | Gérer les titres hors ligne · OK | error | banner | Badge de la ligne ; bandeau |
| `offlineRightsRevoked` | titre gardé dont les droits ont changé (purge au retour en ligne) | Ce titre gardé hors ligne n'est plus autorisé pour ce compte. Il sera retiré de cet appareil à la prochaine connexion au serveur. | This offline title is no longer allowed for this account. | Retour | error | contexte | Carte du lecteur local — **hors-ligne-live / droits-mobile** |

### Notifications

| Cause (code) | Source brute | Message FR (raison + aide) | Message EN (raison) | Actions proposées | Gravité | Forme imposée | Où sur le mobile |
|---|---|---|---|---|---|---|---|
| `pushDenied` | permission `denied` | Les notifications de Tentacle sont coupées sur cet appareil. Autorisez-les dans les réglages de l'appareil pour être prévenu. | Tentacle notifications are turned off on this device. | Ouvrir les réglages · OK | warning | banner | Bandeau (→ Ouvrir les réglages) ; Réglages › Notifications — **branchement : notifs** |
| `pushUnavailable` | permission accordée mais jeton Expo/APNs/FCM introuvable | Cet appareil n'a pas pu s'inscrire aux notifications. Le service de notifications ne répond pas pour le moment. Réessayez plus tard. | This device couldn't sign up for notifications. | Réessayer · OK | warning | banner | Bandeau (→ Réessayer) — **notifs** |

### Diffusion TV et image dans l'image

| Cause (code) | Source brute | Message FR (raison + aide) | Message EN (raison) | Actions proposées | Gravité | Forme imposée | Où sur le mobile |
|---|---|---|---|---|---|---|---|
| `castFailed` | le récepteur Cast refuse le média | La TV n'a pas pu lancer ce titre. Vérifiez que la TV et cet appareil sont sur le même réseau. | The TV couldn't start this title. | Réessayer · Lire sur cet appareil | error | card | Carte du lecteur (→ Lire sur cet appareil) — **branchement : lecteur-mobile** |
| `castLost` | session Cast/AirPlay perdue | La connexion avec la TV a été perdue. Reprenez sur cet appareil, ou relancez la diffusion. | The connection to the TV was lost. | Lire sur cet appareil · Réessayer | warning | card | Carte du lecteur — **lecteur-mobile** |
| `castFormatUnsupported` | le profil `castProfile` n'a pas de forme lisible | La TV ne sait pas lire ce format. Une qualité réduite le fait convertir dans un format plus simple. | The TV can't play this format. | Lire sur cet appareil · Qualité réduite | error | card | Carte du lecteur — **lecteur-mobile** |
| `pipUnavailable` | PiP refusé par le système (réglage Android coupé, iOS sans PiP) | L'image dans l'image est désactivée pour Tentacle sur cet appareil. Vous pouvez l'autoriser dans les réglages de l'appareil. | Picture in picture is turned off for Tentacle on this device. | Ouvrir les réglages · OK | info | banner | Bandeau (→ Ouvrir les réglages) — **lecteur-mobile** |

### Le reste

| Cause (code) | Source brute | Message FR (raison + aide) | Message EN (raison) | Actions proposées | Gravité | Forme imposée | Où sur le mobile |
|---|---|---|---|---|---|---|---|
| `extensionMissing` | 404 d'une extension | Cette extension n'est plus installée, ou elle a été désactivée. L'administrateur peut la réactiver depuis l'administration. | This extension is no longer installed, or it was turned off. | Retour | error | contexte | Écran de l'extension (`ExtensionProblem`) |
| `renderCrash` | exception de rendu React (limite d'erreur), erreur JS fatale | Une erreur inattendue a interrompu l'affichage. Réessayez. Le reste de l'app continue de fonctionner. | An unexpected error interrupted the display. | Réessayer · Retour | error | screen | Écran plein de l'écran fautif (`ScreenErrorBoundary`), la barre d'onglets et la pile continuent ; racine (`ErrorBoundary`) |
| `unknown` | tout le reste ; un code inconnu (`parseProblemCode`) | Une erreur inattendue s'est produite. Réessayez. Si cela se répète, les détails aideront l'administrateur. | Something unexpected went wrong. | Réessayer · Retour | error | contexte | Message générique : « Une erreur inattendue s'est produite » + Réessayer · Retour |

## Branchements à faire par les autres sessions du lot

Tout est prêt dans shared et `apps/mobile/src/problems/` ; il reste à APPELER, depuis les écrans
qu'elles tiennent cette nuit :

| Session | Où | Quoi |
|---|---|---|
| wt-mobile | port `WtPlatformPort.toast`, `wt:error`, `wt:dissolved`, REST | `showProblemBanner(describeProblem({ cause: wtProblemCause(code), context: "watchTogether", values: { name } }), { onAction })` ; la désynchronisation : carte du lecteur (`wtDesync`, action `rejoin` avec `availability.canRejoin`) |
| hors-ligne-live | passage d'une ligne en `error`, attente du Wi-Fi | `showProblemBanner(describeProblem({ cause: offlineTransferCause(errorCode, wait), context: "offlineTransfer" }))` |
| notifs | `pushNotifications.ts` (permission, jeton) | `pushProblemCause(status, registered)` → bandeau avec `availability: { canOpenSettings: true }` |
| lecteur-mobile | diffusion Cast/AirPlay, PiP Android | `castFailed` / `castLost` / `castFormatUnsupported` en carte (`playHere`), `pipUnavailable` en bandeau ; `setPlaybackDiagnostic({ engine, playMethod, transcodeReasons, quality, playSessionId, itemId })` au départ d'une lecture, `setPlaybackDiagnostic(null)` à la sortie |
| famille-mobile | fin de la session de profil | `profileSessionExpired` en écran plein, `availability.canSwitchProfile` + action `switchProfile` |
| droits-mobile | titre masqué par le contrôle parental | `parentalBlocked` |

## « Signaler un problème » — l'API préparée (le bouton viendra plus tard)

Chaque message montré (bandeau, carte, écran, écran qui plante, erreur JS non attrapée) est noté
dans un **journal local tournant** : 50 entrées au plus, la même erreur répétée à moins de 5 s
compte une fois (`repeated`), stocké dans AsyncStorage sous `tentacle_problem_journal` (clé qui ne
se renomme jamais). Rien ne quitte l'appareil sans le geste de l'utilisateur.

Une entrée (`ProblemDiagnostic`) :

```ts
{
  code: "playbackStart/transcodeFailed",   // le code du support
  severity: "error",
  at: "2026-10-20T03:12:45.000Z",          // UTC
  screen: "/watch/abc123",                 // chemin de route, SANS requête
  environment: { platform: "ios", osVersion: "26.3", formFactor: "tablet",
                 appVersion: "1.10.3", appBuild: "…", serverVersion: "1.31.0" },
  playback: { engine: "mpv", playMethod: "Transcode", transcodeReasons: ["VideoCodecNotSupported"],
              quality: "auto", playSessionId: "…", itemId: "…" },   // lectures seulement
  details: ["errors:detailHttp {\"status\":500}", …],              // tamisées
  repeated: 3                              // facultatif
}
```

**Jamais** : un jeton (paramètres `api_key`, `token`, en-têtes `Authorization`, `X-Emby-Token`,
« Bearer … », « token=… » en clair), un mot de passe, un code PIN, une adresse signée ni l'hôte du
serveur (toute adresse devient `https://…/chemin`, sans requête ni fragment), un nom de titre ou de
personne. Les identifiants sont filtrés à `[A-Za-z0-9._:/@+[]()-]` et bornés. Tenu par
`problemJournal.test.ts`.

API du mobile (`apps/mobile/src/problems/problemJournalStore.ts`) :

```ts
attachProblemReport(limit?: number): Promise<ProblemReport>
//   { version: 1, generatedAt, environment, entries /* la plus récente d'abord */ }
recordProblem(model, { detailLines?, screen? })   // déjà appelé par ProblemPanel, showProblemBanner, les limites d'erreur
setPlaybackDiagnostic(partial | null)             // le lecteur pose moteur / décision / session
setProblemServerVersion(version)                  // tenu par ProblemJournalBinding
clearProblemJournal()                             // à appeler à la déconnexion du compte, si voulu
```

Le futur bouton (« Signaler un problème », sous les détails d'un message ou dans Réglages › Aide)
n'aura qu'à : `const report = await attachProblemReport(20)`, puis l'envoyer au serveur
(route à créer, réservée à une capacité serveur — jamais un `if (version >= x)`) ou le partager
par la feuille du système (`Share.share({ message: JSON.stringify(report, null, 2) })`). Le texte
« Copier » d'un message porte déjà son code. Une autre plateforme reprend la règle telle quelle :
`createProblemJournal({ storage })` + `buildProblemDiagnostic`.

## Décisions prises cette nuit (sans Damien)

1. **Code du support = `contexte/cause`** en clair (« playbackStart/transcodeFailed »), pas un numéro :
   lisible à voix haute, cherchable dans le code, stable (ne se renomme jamais).
2. Un **bandeau** dit la CAUSE en titre (« Léa a quitté la séance »), pas le titre du contexte ; un
   constat (`info`) n'a pas de code, un échec (`error`) l'a en dernière ligne.
3. Seul un bandeau peut n'avoir **aucune action** (un constat) ; une carte ou un écran a toujours une issue (tenu par le test).
4. « OK » (`dismiss`) n'apparaît pas dans un bandeau (il se ferme d'un glissé) ; il sert aux cartes et feuilles.
5. Les refus du jeu **d'Affinité** (Watch Together) restent dits par son écran : `wtProblemCause` les rend en générique.
6. La limite d'erreur passe par `screenLayout` (React Navigation 7) plutôt qu'un `export ErrorBoundary`
   dans chaque route : trois lignes au lieu de soixante fichiers, et aucun conflit avec les écrans du lot.
7. `playSessionId` est GARDÉ dans le diagnostic (demandé, et sans pouvoir d'accès) mais retiré des adresses.
