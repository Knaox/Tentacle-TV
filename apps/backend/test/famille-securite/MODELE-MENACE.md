# Modèle de menace — la Famille (T8, lot du 2026-10-04)

> Document de sécurité, livrable de la phase 1. Il décrit ce qu'on protège, de
> qui, par où une attaque passerait, et surtout les **exigences testables**
> (`SEC-F-xx`) qui serviront à la fois de contrat pour T2 (serveur) et de cible
> pour les tests d'attaque de la phase 2 (dossier `test/famille-securite/`).
>
> Règle d'or de Damien : « 100 % sécurisé, c'est hyper important », **y compris
> sur un serveur en HTTP** (homelab sans TLS). Donc : rien ne repose sur le TLS,
> sur un cookie `Secure`, ni sur une API navigateur réservée au contexte sûr.
> Tout se décide **côté serveur**, à l'identique en HTTP et en HTTPS.

---

## 1. Périmètre et hypothèses

Ce qui est NOUVEAU avec la Famille (ce que T2 construit) :

- des **familles** (propriétaire + membres + invités) ;
- des **invitations** entre comptes du serveur ;
- des **invités** = vrais comptes Jellyfin cachés, frappés par le serveur ;
- un **code PIN** facultatif par profil ;
- la **TV du propriétaire** qui liste SES profils et en ouvre une session ;
- des **interrupteurs admin** « Familles » et « Profils invités ».

Socle existant, réutilisé et déjà durci (lu en phase 1, sert de référence) :

- JWT d'appareil `type:"paired_device"` **sans expiration** ;
  révocation = suppression de la ligne `paired_devices`, verdict **unique**
  `pairedDeviceStatus()` relu à chaque porte (REST, proxy, socket, refresh) ;
- proxy `/api/jellyfin/*` : substitue la **clé admin** à un JWT d'appareil,
  gardé par liste blanche (`patterns.ts`) + **garde de périmètre** `userScope`
  (un appareil ne parle que pour SON `userId`, chemin ET query) ;
- jeton Jellyfin **propre** par appareil via Quick Connect (clé admin autorise
  pour un autre compte), lié au `jellyfinDeviceId` dérivé ; révocation =
  `DELETE /Devices` ; **jamais** la copie du jeton d'un appareil frère ;
- cookie `tentacle_token` : `httpOnly`, `sameSite:strict`, `secure:"auto"`
  (suit le protocole réel) ;
- limites par route (`login` 5/min, `generate` 10/h…) + deux seaux globaux.

Hypothèses d'environnement :

- **H1** — le serveur peut tourner en clair (HTTP). Le réseau local peut être
  écouté. Donc un jeton qui circule peut être capté par un voisin de LAN ;
  la sécurité ne doit pas *dépendre* du secret du transport, mais la Famille ne
  doit pas non plus *élargir* ce qui fuit (aucun secret nouveau dans URL/journal).
- **H2** — dev et prod partagent le même Jellyfin (`jellyfinIdentity`) :
  toute identité envoyée à Jellyfin porte l'`installId`. Un invité frappé par le
  serveur de dev ne doit pas entrer en collision avec la prod.
- **H3** — la clé d'API admin Jellyfin reste côté serveur uniquement.
- **H4** — le relais public (`relay/`) et le code de provisionnement (12 car.)
  existent pour la revue Apple ; le compte de démo ne doit **rien** créer chez
  Jellyfin ni dans une famille.

---

## 2. Actifs à protéger

| # | Actif | Pourquoi |
|---|-------|----------|
| A1 | **Comptes Jellyfin des membres** | un retrait ne doit JAMAIS toucher le compte Jellyfin d'un membre. |
| A2 | **Comptes invités (Jellyfin)** | vrais comptes à droits du propriétaire ; leur jeton = accès complet au catalogue. |
| A3 | **Mot de passe fort de l'invité** | jamais stocké, jamais montré, jamais rejouable pour une connexion par nom/mot de passe. |
| A4 | **Jetons de profil (par profil sur la TV)** | chacun ouvre une session ; fuite = usurpation d'un profil. |
| A5 | **Codes PIN** | hachés côté serveur ; protègent le changement de profil et « Gérer les profils ». |
| A6 | **Identifiants d'invitation** | ne doivent pas être devinables (IDOR / énumération). |
| A7 | **Clé d'API admin Jellyfin** | compromission = tout le serveur Jellyfin. |
| A8 | **Liste des comptes cachés / invités** | ne doit apparaître dans aucune liste ni être énumérable. |
| A9 | **Jeton de jumelage de la TV** | une fois la TV passée aux profils, il ne vaut plus session du propriétaire. |

---

## 3. Acteurs / adversaires

| Code | Acteur | Capacités supposées |
|------|--------|---------------------|
| AC1 | **Membre** d'une famille | compte serveur valide + son jeton ; curieux ou malveillant. |
| AC2 | **Invité** | session de profil invité sur une TV du propriétaire ; peut tenter d'atteindre l'app/les routes. |
| AC3 | **Foyer du propriétaire** (personne physique ayant accès à une TV du propriétaire) | peut manipuler la TV, tenter PIN, « Gérer les profils ». |
| AC4 | **Autre utilisateur du serveur** (hors famille) | compte serveur valide ; veut entrer dans une famille, obtenir un jeton d'un compte tiers. |
| AC5 | **Réseau en HTTP** | écoute passive + rejeu sur le LAN ; peut forger des requêtes. |
| AC6 | **TV volée / revendue** | détient un jeton de jumelage et/ou des jetons de profil en stockage local. |
| AC7 | **Ancien membre / ancien invité** | a détenu un accès, puis retiré/supprimé ; veut le conserver. |
| AC8 | **Client ancien** (app d'avant la Famille) | jeton de jumelage d'avant, qui doit continuer de marcher sans ouvrir de faille. |
| AC9 | **Compte de démo Apple** | jumelé par code de provisionnement ; ne doit rien créer. |

---

## 4. Surface d'attaque (nouveaux canaux Famille)

- **REST famille** : créer/dissoudre une famille, inviter, accepter/refuser,
  quitter, retirer, créer/supprimer un invité, poser/vérifier un PIN.
- **REST profils TV** : lister les profils d'une TV, ouvrir une session de
  profil, quitter un profil, « Gérer les profils » (garde PIN propriétaire).
- **Socket** : annonce en direct d'une invitation (Accepter/Refuser/Plus tard),
  coupure immédiate d'un profil (`profile:revoked` ou équivalent).
- **Push** (faux Expo en dev) : notification d'invitation.
- **Admin** : interrupteurs « Familles » / « Profils invités ».
- **Côté Jellyfin** : création/suppression de comptes invités (clé admin),
  Quick Connect pour frapper le jeton d'un profil invité.

---

## 5. Cas d'abus → exigences

Chaque cas d'abus est relié à l'exigence testable qui le ferme (section 6).

- **CA1** — AC4 invite ou accepte **au nom d'un autre** compte. → SEC-F-01/02.
- **CA2** — AC4/AC1 lit/annule une invitation qui ne lui est pas destinée en
  devinant/incrémentant son identifiant (**IDOR**). → SEC-F-03/06.
- **CA3** — AC1 (membre) agit en **propriétaire** : invite, retire, supprime un
  invité, dissout. → SEC-F-07.
- **CA4** — AC2/AC3 accepte/refuse une invitation **depuis une TV** ou un profil
  de TV. → SEC-F-04.
- **CA5** — AC4 obtient un **jeton de profil** pour un compte **hors de sa
  famille**, ou pour une TV qui n'est pas la sienne. → SEC-F-08/09.
- **CA6** — AC7 conserve un accès **après** retrait, départ, suppression
  d'invité, déjumelage, changement de PIN, ou coupure admin. → SEC-F-10..15.
- **CA7** — AC3 **force le PIN** (brute force) ou le **contourne**. → SEC-F-16/17/18.
- **CA8** — AC6/AC8 : un jeton de **jumelage** d'une TV passée aux profils vaut
  encore **session du propriétaire** (le PIN ne serait qu'une façade). → SEC-F-19.
- **CA9** — un **invité apparaît** dans une liste (Watch Together, candidats à
  l'invitation, utilisateurs admin, etc.). → SEC-F-20/21.
- **CA10** — AC4 **énumère les comptes cachés** via les candidats à
  l'invitation. → SEC-F-22.
- **CA11** — spam d'invitations / de PIN / de création d'invités (**quotas**). → SEC-F-23.
- **CA12** — **injection** dans un nom (famille, invité) rendu sur TV, web, push. → SEC-F-24.
- **CA13** — une charge **push/socket** porte un **secret** ou atteint un non
  concerné. → SEC-F-25/26.
- **CA14** — un **secret** (PIN, jeton, mot de passe invité) finit dans un
  **journal** ou une **URL**. → SEC-F-27.
- **CA15** — le **compte de démo** crée une famille, un invité, ou touche
  Jellyfin. → SEC-F-28.
- **CA16** — le **mot de passe de l'invité** est stocké, renvoyé, ou permet une
  connexion par nom/mot de passe. → SEC-F-29/30.
- **CA17** — un profil **invité** obtient un droit d'**admin**, de gestion, de
  suppression, ou de téléchargement de contenu. → SEC-F-31.
- **CA18** — **HTTP ≠ HTTPS** : une garde tombe en clair (cookie non `Secure`,
  contexte non sûr). → SEC-F-32.
- **CA19** — dépassement des **limites** 6 profils / 3 invités par famille, ou
  d'« une famille par propriétaire ». → SEC-F-33.
- **CA20** — AC4 **rejoue** un jeton de profil capté sur le LAN après qu'il a
  été invalidé (révoqué chez Tentacle ET chez Jellyfin). → SEC-F-11/15.

---

## 6. Exigences testables (`SEC-F-xx`)

> Format : chaque exigence est une **assertion vérifiable** par une requête (ou
> une séquence) et un résultat attendu (code HTTP + effet DB/Jellyfin). Les
> tests de la phase 2 porteront ces identifiants.

### Invitations — autorité et IDOR

- **SEC-F-01** — Inviter se fait **en son propre nom** : le serveur dérive
  l'inviteur du jeton, jamais d'un champ du corps. Fournir `ownerUserId`/
  `fromUserId` ≠ porteur n'y change rien (ignoré ou 403). *Preuve : POST invite
  avec `fromUserId` d'un tiers → l'invitation créée a pour inviteur le porteur.*
- **SEC-F-02** — Accepter/refuser **pour soi seul** : le destinataire est le
  porteur du jeton ; on ne peut pas accepter une invitation adressée à un autre
  (403/404), ni en passant un `userId` dans le corps.
- **SEC-F-03** — **IDOR invitation** : `GET/POST/DELETE` sur une invitation dont
  on n'est ni l'émetteur ni le destinataire → **404** (pas 403 : ne pas
  confirmer l'existence). Vrai en incrémentant/forgeant l'identifiant.
- **SEC-F-04** — Accepter/refuser **interdit depuis une TV ou un profil de TV** :
  un jeton d'appareil (`type:"paired_device"`) ou une session de profil sur la
  route accept/refuse → **403**, aucune mutation.
- **SEC-F-05** — Une invitation **expire à 7 jours** : après expiration,
  accepter → 410/404, aucune adhésion créée.
- **SEC-F-06** — Les identifiants d'invitation ne sont **pas énumérables** :
  non séquentiels, assez longs (≥ 128 bits d'entropie, ex. cuid/uuid/random), et
  la réponse ne distingue pas « inexistant » de « pas à toi » (404 dans les deux
  cas, même corps).

### Appartenance et rôles

- **SEC-F-07** — **Actions propriétaire** (inviter, retirer, créer/supprimer un
  invité, dissoudre) exigent d'être **propriétaire de CETTE famille** : un
  membre → 403 ; un non-membre → 404 ; vérifié côté serveur, pas sur le client.
- **SEC-F-33** — **Limites** imposées serveur : ≤ 6 profils/famille
  (propriétaire compris), ≤ 3 invités/famille, **1 famille créée** par
  propriétaire. Dépassement → 409, rien créé. Course concurrente (deux créations
  d'invité simultanées) ne dépasse pas la limite.

### Jetons de profil (TV)

- **SEC-F-08** — Un jeton de profil n'est délivré que pour un **profil de la
  propre famille** de la TV : demander un profil hors de la famille de la TV →
  403/404, aucun jeton émis.
- **SEC-F-09** — Ouvrir un profil n'est possible **que depuis la TV du
  propriétaire** (celle jumelée par lui) : une autre TV → 403.
- **SEC-F-19** — Une TV **passée aux profils** : son jeton de **jumelage** ne
  vaut plus session du propriétaire — il ne sert QU'À lister les profils et
  ouvrir une session de profil. Toute requête de données de compte présentée
  avec le seul jeton de jumelage (sans session de profil) → 401/403. *Une TV
  d'AVANT les profils (AC8) garde son jeton : testé séparément, doit continuer.*

### Persistance de la révocation (le cœur)

> Pour chacune : après l'évènement, **toute** requête du profil touché échoue
> immédiatement, aux portes REST **et** socket, et le jeton Jellyfin du profil
> est révoqué chez Jellyfin (`DELETE /Devices`), pas seulement chez Tentacle.

- **SEC-F-10** — Après **retrait** d'un membre : ses jetons de profil issus de
  cette famille sont révoqués ; son compte Jellyfin **intact** (il peut encore
  se connecter normalement hors famille).
- **SEC-F-11** — Après **départ** volontaire d'un membre : idem SEC-F-10.
- **SEC-F-12** — Après **suppression d'un invité** : le **compte Jellyfin** de
  l'invité est supprimé ; ses jetons/sessions morts partout.
- **SEC-F-13** — Après **changement de PIN** d'un profil : les sessions de
  profil ouvertes sont coupées (re-vérification du PIN exigée).
- **SEC-F-14** — Après **coupure admin** (« Familles » ou « Profils invités »
  désactivé) : les sessions de profil concernées sont coupées ; réactiver ne
  ressuscite pas une session morte.
- **SEC-F-15** — Après **déjumelage** de la TV : tous les profils de cette TV
  sont coupés ; **mais** déjumeler ne **supprime jamais** un invité (son compte
  Jellyfin survit). La coupure est effective **avant** le retour HTTP (comme la
  révocation d'appareil existante) et un rejeu du jeton (AC20) → 401.
- **SEC-F-20 (rappel révocation)** — La coupure pousse un message **en direct**
  sur la socket du profil (coupure immédiate), pas seulement au prochain échec
  d'auth.

### PIN

- **SEC-F-16** — Le PIN est **haché** et vérifié **par le serveur** : il n'est
  jamais envoyé à la TV ni comparé sur la TV. *Preuve : aucune route ne renvoie
  le PIN ni son hash ; la réponse de liste de profils ne contient pas le PIN.*
- **SEC-F-17** — **5 essais** ratés → **blocage temporaire** du profil ; les
  essais suivants échouent même avec le bon PIN pendant le blocage. Le compteur
  est serveur (pas contournable en changeant d'appareil/IP pour le même profil).
- **SEC-F-18** — Le PIN du **propriétaire** protège « **Gérer les profils** » sur
  la TV : sans PIN validé, la route de gestion → 403.
- **SEC-F-30 (PIN jamais renvoyé)** — Aucune réponse (liste profils, état
  famille, erreur) ne contient le PIN en clair ni son hash. Couvre aussi la
  réponse d'erreur d'un PIN faux (ne révèle pas le bon).

### Invités — invisibilité et droits

- **SEC-F-21** — Un invité **n'apparaît pas** dans les candidats à l'invitation
  (`/api/watch-together/users`), ni dans Watch Together, ni dans
  `GET /api/admin/users`, ni dans le classement/reco-fanout. *Marqueur stable
  d'« invité » côté serveur ; le filtre est serveur, pas client.*
- **SEC-F-22** — **Comptes cachés non énumérables** : les candidats à
  l'invitation ne révèlent pas un compte caché de l'écran de connexion Jellyfin ;
  on ne peut en cibler un que par son **nom exact** (pas de liste, pas de
  préfixe). Un compte désactivé, soi-même, un membre déjà présent, un invité →
  jamais candidat.
- **SEC-F-31** — Un compte **invité** est créé **non-admin**, sans droit de
  gestion, de suppression, ni de **téléchargement** de contenu, avec les **mêmes
  bibliothèques et restrictions** (contrôle parental, tags) que le propriétaire.
  *Preuve : la policy Jellyfin posée à la création reflète ces contraintes ; un
  jeton de profil invité se voit refuser une route admin (403) et le
  téléchargement.*
- **SEC-F-29** — Le **mot de passe** de l'invité est **fort et aléatoire**,
  **jamais stocké** (ni en base Tentacle, ni renvoyé), et une **connexion par
  nom/mot de passe** de l'invité est **impossible** (compte caché de l'écran de
  connexion ; personne ne connaît le mot de passe). *Preuve : après création,
  `AuthenticateByName(invité, <toute valeur>)` échoue ; la base ne contient
  aucune colonne portant ce mot de passe.*

### Listes, quotas, injection, fuites

- **SEC-F-23** — **Quotas anti-spam** : invitations (par émetteur / par
  destinataire), créations d'invité, essais de PIN — tous plafonnés serveur
  (429 au-delà) ; **délai avant de réinviter** quelqu'un qui a refusé.
- **SEC-F-24** — Les **noms** (famille, invité) sont bornés en longueur, validés
  (Zod), et rendus **échappés** : un nom contenant `<script>`, `"`,
  `${}`, un saut de ligne, ou un très long texte ne casse ni le rendu TV/web ni
  le texte du push (pas d'injection, pas de dépassement).
- **SEC-F-25** — La **charge push** d'une invitation ne contient **aucun jeton**
  ni PIN ; elle ne part qu'aux comptes **concernés** (le destinataire).
- **SEC-F-26** — Les messages **socket** de la Famille ne portent aucun jeton et
  n'atteignent que les connexions des comptes concernés (un tiers connecté ne
  reçoit pas l'annonce d'invitation d'autrui).
- **SEC-F-27** — **Journaux sans secret** : aucun PIN, jeton de profil, mot de
  passe invité, ni identifiant d'invitation complet n'apparaît dans les logs ;
  aucun de ces secrets n'est passé en **query string** d'une URL.

### Compte de démo et HTTP

- **SEC-F-28** — Le **compte de démo** (`DEMO_MODE`, jumelé par provisionnement)
  ne peut **créer** ni famille, ni invité, ni invitation, et ne déclenche aucune
  écriture chez Jellyfin. Les routes famille lui répondent 403 (ou sont inertes).
- **SEC-F-32** — **Parité HTTP/HTTPS** : toutes les gardes ci-dessus tiennent à
  l'identique quand le serveur est en clair. Aucune garde ne dépend d'un cookie
  `Secure`, d'une API en contexte sûr, ni du TLS. *Preuve : la suite d'attaque
  tourne deux fois (HTTP puis HTTPS) avec les mêmes verdicts (recette phase 4).*

### Proxy Jellyfin — faille existante à corriger (hors Famille, signalée par le coordinateur)

- **SEC-F-34** — Un **jeton d'appareil** ne doit **jamais** obtenir la clé
  d'administration pour une **mutation arbitraire** de Jellyfin. La substitution
  de la clé admin ne vaut que pour les routes de lecture/session autorisées ; la
  garde de périmètre (`userScope`) ne couvre que `/Users/{id}/…`, or la liste
  blanche laisse passer `Items/{id}` en **toutes méthodes**. *Prouvé rouge le
  2026-10-04 : `DELETE`/`POST /api/jellyfin/Items/{id}` porté par un JWT
  d'appareil → 200, exécuté chez Jellyfin avec la clé admin. Attendu après
  correction (T2) : refus (403 ; 401 toléré), et aucune mutation ne part avec la
  clé admin. Test : `proxyMutationAppareil.attack.test.ts` (en attente de la
  correction).*

---

## 7. État des tests d'attaque (phase 4, 2026-10-04 — T2…T5 fusionnés)

Tests ACTIFS dans `test/famille-securite/` (tous verts) :

- `familleReglesPures.attack.test.ts` — règles pures : SEC-F-05, 14, 17, 22, 23, 24, 33.
- `familleContratRoutes.attack.test.ts` — invariants du contrat de routes :
  SEC-F-04, 07, 18, 19, 27, codes de refus.
- `proxyMutationAppareil.attack.test.ts` — SEC-F-34 (faille proxy), **corrigée par
  T2** et le test dé-skippé : vert.
- `familleAutorite.attack.test.ts` — SEC-F-01, 02, 03, 05, 06, 07, 33 (vraies routes).
- `familleProfilsTv.attack.test.ts` — SEC-F-08, 09, 16, 17, 18, 19, 30.
- `familleRevocation.attack.test.ts` — SEC-F-10, 11, 12, 13, 14, 15, 20.
- `familleInvites.attack.test.ts` — SEC-F-21, 29, 31.
- `familleCandidatsFuites.attack.test.ts` — SEC-F-22, 25, 26, 27, 28.
- `familleParite.attack.test.ts` — SEC-F-32 (versant statique : la Famille ne lit
  jamais le transport).

Tous les `SEC-F-xx` sont désormais des tests actifs (plus aucun `todo`/`skip`).

### Recette de bout en bout (phase 4) — preuves de banc

Contre le **vrai Jellyfin jetable** (10.11.11, suite de compat `--keep`, conteneurs
`lot-f8-`), backend réel, faux Expo :

- `suites/family.compat.ts` — **6/6 en HTTP** ET **6/6 en HTTPS** (proxy
  `localtest.me`, TLS réel, `X-Forwarded-Proto: https`) : invité réel caché/sans
  droit/mot de passe inconnu, jeton de profil par Quick Connect, déjumelage qui
  coupe chez Jellyfin.
- Push (faux Expo) : une invitation ne pousse qu'au destinataire, charge
  `{type:"family_invite", refId}` — aucun jeton, PIN ni mot de passe (SEC-F-25).
- Parcours complet (`scratchpad/recette.mjs`, outil de banc) — **18/18 en HTTP**
  ET **18/18 en HTTPS** : invitation web → acceptation (mobile) → TV « Qui
  regarde ? » (propriétaire + membre, sélecteur) → invité + PIN jugé par le
  serveur (mauvais PIN 403) → le membre ouvre son profil (lecture) → **quitte la
  famille → session coupée AUSSITÔT côté Tentacle (401 profileEnded) ET appareil
  supprimé côté Jellyfin (DELETE /Devices)** ; compte Jellyfin de l'ex-membre
  intact, invité non touché.

Reste à la recette du MATIN (validation visuelle, pas de sécurité nouvelle) : le
rendu sur simulateurs réels (affiche d'invitation sur le mobile, « Qui regarde ? »
et saisie du PIN sur l'Apple TV). La logique de ces écrans est déjà couverte par
les tests d'attaque et le parcours serveur ci-dessus.

## 8. Notes pour T2 (conception serveur, en parallèle)

- Dériver **toujours** l'acteur du jeton (jamais d'un `userId` de corps/query) —
  même règle que `userScope` du proxy.
- Réutiliser la **révocation commune** (`deviceRevocation.ts`) et le verdict
  **unique** (`pairedDeviceStatus`) : un profil coupé doit l'être par **une**
  porte, relue partout (REST + socket), effet **avant** le retour HTTP.
- Un invité = compte Jellyfin via **Quick Connect + clé admin** (jamais une
  copie de jeton) ; `DELETE /Devices` pour couper ; `jellyfinIdentity` pour
  l'`installId` (H2).
- Identifiants d'invitation en `cuid()`/aléatoire (comme `PairedDevice.id`),
  jamais séquentiels.
- PIN : `hashToken`-style (sha256 **salé** ; de préférence un KDF lent type
  scrypt/bcrypt vu le petit espace 4 chiffres) ; compteur d'essais **serveur**,
  par profil.
- Marqueur **« invité »** persistant côté serveur, lu par **tous** les
  producteurs de listes (`usersCache` de Watch Together, `adminUsers`,
  `leaderboard`, `reco/fanout`) — un seul endroit à filtrer, sinon l'invité
  réapparaît quelque part.
