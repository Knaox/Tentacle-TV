# Watch Together — l'adhésion PAR APPAREIL (serveur 1.31.1)

Capacité `watchTogether.deviceMembership`. Lot « mobile = bureau » du 20/10.

## Le bug

Damien regarde en groupe sur ses deux PC avec un ami, puis ouvre le web sur
le même compte. Avant, l'adhésion était PAR COMPTE : le web recevait l'état
de la salle, se voyait lancer le film, et fermer sa page (`wt:goodbye`) faisait
quitter la salle au compte — donc aux deux PC.

## La règle

Un **appareil** est le hash du jeton qui ouvre sa socket et signe ses appels
REST (`hashToken` : le cookie du web, l'`Authorization` du bureau et du
mobile). Le serveur le connaît déjà : aucun client n'a rien à annoncer, et un
client d'avant profite du correctif comme les autres. Les onglets d'un même
navigateur partagent le cookie : ils sont UN appareil, comme avant.

**Le jeton qui fait foi** (20/10, `services/sessionTokenChoice.ts`) : le
téléphone garde le cookie de sa CONNEXION (le compte, posé par
`/api/auth/login`) et le renvoie avec chaque requête et chaque poignée de main
WebSocket. Le Bearer et le message `auth` l'emportent sur ce cookie — sans
quoi, en session de profil, l'hôte, le membre, la présence et l'appareil lié
étaient ceux du compte (alpha mobile : « le propriétaire s'appelait Knaox »,
invitation acceptée jamais vue). Un cookie posé par le serveur (profil du web,
« voir en tant que ») l'emporte toujours. Preuves :
`test/wtProfileSessionCookie.test.ts`, `bench:wt-profile-cookies`.

Un membre (un compte) a 1..n appareils **liés** :

- celui qui crée la salle (`POST /group`) ;
- celui qui accepte l'invitation (`POST /invites/:id/respond`) ;
- celui qui choisit « Rejoindre ici » (`POST /group/join-here`).

Seuls les appareils liés reçoivent la séance — `wt:state`, chat, réactions,
affinité, `wt:dissolved`, résultat d'invitation — et y parlent. Pour un autre
appareil du compte :

- `GET /group` → `null` (comme hors salle) ; ses `wt:*` → `wt:error not_in_group` ;
- `POST /group/leave`, `/group/kick`, `/group/invites` → 404 `not_in_group` :
  **il ne fait rien quitter à personne** ;
- il reçoit l'avis `wt:elsewhere` (`{ groupId, hostUsername, itemId,
  memberCount, deviceCount }`, `null` à la fin) à sa connexion et à chaque
  entrée, départ, expulsion, changement de titre ou d'hôte ; au démarrage,
  `GET /group/elsewhere`. Les clients en font une pilule discrète :
  « Groupe en cours sur un autre appareil — Rejoindre ici ».
- `POST /group` → 409 `already_in_group` (un compte, une salle) : les clients
  proposent « Rejoindre ici » à la place de « Créer un groupe ».

## Décisions tranchées (20/10, Damien absent)

1. **« Rejoindre ici » AJOUTE l'appareil, il ne transfère pas.** Les deux PC
   de Damien restent tous deux dans la salle : c'est le cas qui a fait naître
   la règle. Pour quitter sur un appareil, « Quitter » sur celui-là.
2. **« Quitter » est par appareil.** Le compte quitte la salle avec son
   DERNIER appareil lié (transfert d'hôte, dissolution comme avant). Un
   « Quitter » explicite emporte aussi les appareils liés HORS LIGNE (en grâce) :
   un appareil éteint ne garde pas le compte dans la salle (constat du banc).
   Et créer un groupe quand TOUS les appareils liés du compte sont éteints
   libère l'ancienne salle au lieu de répondre 409.
3. **La grâce de déconnexion est par appareil** (120 s ; 10 s après
   `wt:goodbye`, et seulement si l'appareil n'a plus aucune socket ouverte : un
   autre onglet du même navigateur le tient). Un appareil lié qui ne revient
   pas est délié ; le dernier emporte le compte.
4. **Expulser vise le compte entier** : tous ses appareils liés l'apprennent.
5. **Accepter une invitation d'un AUTRE groupe** déplace le compte, comme
   avant ; ses appareils liés à l'ancien groupe reçoivent `wt:dissolved`.
6. **Un membre sans appareil lié** (appel interne, bancs d'avant) garde le
   comportement d'avant : tout le compte (`memberDevices.ts`).

## Compatibilité

- Le web est servi par le serveur : toujours à jour avec lui.
- Un **bureau d'avant** sur un second appareil du compte ne suit plus la
  salle implicitement, et n'a pas de « Rejoindre ici » : il faut le mettre à
  jour (ou y accepter une invitation). Conséquence assumée du correctif.
- Le jeton change à une reconnexion complète (nouvelle connexion, mobile
  ré-authentifié) : l'appareil n'est plus lié — l'avis propose de rejoindre ;
  l'ancien se délie au bout de sa grâce.
- Le mobile n'affiche Watch Together qu'avec la capacité : sans elle, sa
  séance reste éteinte (`WtPlatformPort.enabled: false`).

## Où

- Serveur : `apps/backend/src/services/watchTogether/memberDevices.ts`
  (liaison, envoi, en ligne, grâce), `elsewhere.ts`, `deviceLeave.ts`,
  `gatewayPresence.ts`, `requestDevice.ts`, `routes/watchTogetherDevices.ts` ;
  `services/wsDeviceSockets.ts` (les sockets par appareil).
- Contrat : `packages/shared/src/types/watchTogetherDevices.ts` (miroir backend).
- Clients : `useWatchTogetherSession` (`elsewhere`, `actions.joinHere`),
  web `ElsewhereNotice.tsx`, panneau et fiche.
- Tests : `deviceMembership.test.ts` (le scénario des deux PC + web),
  `routes/watchTogetherDevices.test.ts`.
