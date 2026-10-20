# Garder hors ligne, application quittée — le carnet

Retours de l'alpha mobile (21/10) : sur de vrais téléphones, iOS ET Android, quitter
l'application pendant « En préparation » arrêtait tout, et rien ne reprenait en
arrière-plan ; sur l'iPhone, aucune Live Activity. Ce carnet dit pourquoi, ce qui a
été retenu, et ce qui ne se vérifie que sur un vrai téléphone.

## Les causes

| # | Plateforme | Cause | Correctif |
|---|-----------|-------|-----------|
| 1 | Android | Balayer l'app des récentes arrêtait le service de premier plan (`onTaskRemoved`) : processus tué. | Le service reste ; il s'arrête quand le moteur se libère ou avec le module. |
| 2 | Android | React Native gèle `setTimeout` dès l'activité en pause (`JavaTimerManager`), sauf pendant une tâche headless : relance, délais, rythme du suivi ne partaient plus. | Tâche headless sans fin `TentacleOfflineTransfers` le temps que le moteur s'occupe (`JsKeepAlive.kt`, `androidKeepAlive.ts`). |
| 3 | Les deux | Une coupure réseau devenait une pause système relevée seulement par un évènement (premier plan, réseau, redémarrage). | Relance seule, 5 s → 5 min, sans fin, remise à zéro dès des octets (`NETWORK_RETRY_DELAYS_MS`, offline-core). |
| 4 | iOS | Snapshot et sous-titres (fetch JS) passaient AVANT la remise du média à la session d'arrière-plan : JS suspendu, média jamais parti. | Le média part d'abord, les à-côtés pendant (`worker.ts`). |
| 5 | iOS | Un minuteur ne sonne jamais sur un iPhone qui dort. | Trois relances SANS délai derrière (`immediateNetworkRetries`) : la tâche remise au système attend le réseau seule. |
| 6 | Les deux | Le téléphone tirait le transcodage en direct (`/light`) : préparation liée à SA connexion, repartie de zéro à chaque coupure. | Préparation tenue par le serveur (`offline.serverPrepare`), ci-dessous. |
| 7 | iOS | Une activité d'un lancement d'avant, terminée par nous, restée `dismissed`, passait pour balayée par la personne : aucune Live Activity pour le lot. | Seule une activité de CE lancement compte (`LiveActivityBridge.startedIds`). |

## La préparation tenue par le serveur (`offline.serverPrepare`, serveur 1.31.1)

- `GET /api/downloads/prepared/:itemId` — mêmes paramètres et droits que `/light`. Le
  premier appel lance la préparation : le serveur tire Jellyfin et écrit dans
  `data/offline-prepare/`, QUE LE TÉLÉPHONE SOIT LÀ OU NON. La réponse suit le fichier qui
  grandit jusqu'à la fin (un seul transfert continu, confiable à la session d'arrière-plan
  d'iOS comme au service d'Android).
- Reprise : `Range: bytes=N-` honorée seulement pour l'appareil qui a déjà lu CETTE
  préparation (`?tag=`, étiquette tirée une fois et gardée dans la base locale du hors
  ligne, `prepare_tag`). Sinon 200 depuis le début : une préparation recréée n'écrit pas
  forcément les mêmes octets, et les deux plateformes jettent alors leur morceau.
- `DELETE` : le téléphone n'en veut plus — à l'arrivée du fichier ou à l'annulation, jamais
  à une pause. Effacement automatique : 24 h après le dernier passage (prête), 12 h (en
  cours, réclamée par personne). En mémoire : un redémarrage du serveur vide le dossier.
- Push SILENCIEUSE iOS (`content-available`, `data.type = "offline:prepared"`) quand une
  préparation s'achève SANS lecteur : l'iPhone dont le transfert a été coupé est réveillé
  (`PushWake.swift` → `wakeForPrepared`) et reprend par plage un fichier complet.
- Sans la capacité : `/light`, comme avant.

## Mesuré (banc, 20/10)

Jellyfin jetable du banc WT, backend de la branche : client coupé à 2 s → le serveur
continue seul (17 → 26 → 36 Mo sans client) ; reprise par plage sur une préparation
finie (206, `Content-Range` exact) et PENDANT la préparation (206 qui suit jusqu'au bout)
→ octets identiques au fichier entier, MP4 valide (h264/aac, 300 s) ; un autre appareil
avec la même plage → 200 depuis le début ; `DELETE` → fichier effacé.

## Ce qui ne se voit que sur un vrai téléphone

- iOS : un iPhone « tué » par la personne (balayé du sélecteur) annule ses transferts
  d'arrière-plan et ne reçoit plus de push silencieuse — règle d'Apple. La préparation,
  elle, continue sur le serveur : à la réouverture, le transfert repart aussitôt.
- iOS : une tâche lancée pendant un réveil d'arrière-plan est « discrétionnaire » : le
  système peut la différer (Wi-Fi, charge).
- iOS : la push silencieuse exige un jeton de push, que l'app ne demande qu'avec les
  notifications autorisées. Sans elles, la reprise attend le premier plan.
- Android : certains constructeurs tuent quand même un processus balayé, service ou non ;
  au relancement, le moteur reprend par plage là où il en était.
- Live Activity : le pour-cent écrit ne bouge qu'aux mises à jour de l'application ; la
  barre et le compte à rebours avancent seuls.
