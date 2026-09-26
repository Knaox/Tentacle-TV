# Livraison — guide développeur

**Un workflow par plateforme, trois crans, un seul geste.** La CI (GitHub
Actions, gratuite car le dépôt est public) construit, signe, envoie, publie —
et ne laisse rien à cliquer ensuite.

## Le geste : « Tentacle Deploy.html »

La page vit **hors dépôt** (Bureau) parce qu'elle porte un jeton GitHub à portée
fine (Actions : lecture et écriture ; Contenu : lecture), rangé dans le
localStorage du navigateur. Elle déclenche les workflows par l'API : plateforme,
cibles, cran, éventuellement une version, puis **Déployer**. Elle suit ensuite
l'avancement des jobs sans qu'on quitte la page.

Avant le clic, elle affiche deux choses qui décident de tout :

- **l'état du contrôle qualité** sur la tête de `main` — rouge, la livraison
  serait refusée ;
- **la taille des notes de version** par store, avec le nombre de caractères que
  la coupe va jeter. C'est là qu'on voit qu'un bloc manque : le bouton se
  désactive.

> ⚠️ Son vocabulaire est celui des entrées de workflow (`targets`, `channel`,
> `version`, `promote`) ; `webos.yml` et `server.yml` n'ont ni `targets` ni
> `promote`. Une entrée que le workflow ne déclare pas fait **refuser** le
> déclenchement (422 « Unexpected inputs provided ») ; une entrée déclarée que
> la page n'envoie plus prend son défaut **en silence**.

Sans jeton, la page affiche la commande `gh workflow run` équivalente.

## Les trois crans

| `channel` | Ce qui se passe |
|-----------|-----------------|
| `build` | Artefacts du run. **Rien ne part nulle part.** |
| `test` | Play : piste FERMÉE en `completed` (plus de draft à promouvoir) · Apple : TestFlight distribué au groupe externe + examen bêta demandé · Linux : Release en **pré-version**, manifeste non patché · serveur : `:vX.Y.Z` seul, `:latest` intact · webOS : Release versionnée, `webos-latest` intact · Windows : artefact seulement (le Microsoft Store n'a pas de canal de test). |
| `store` | Play : **production, 100 %** · Apple : **examen soumis**, `releaseType: AFTER_APPROVAL` — en vente dès l'approbation · Microsoft Store : soumission immédiate · Linux : Release publiée + manifeste d'auto-update · serveur : `:latest` + Release · webOS : `webos-latest` basculé. |

`promote` (le défaut au cran store) reprend **le binaire déjà testé** : le
versionCode servi par la piste fermée passe en production, la version App Store
part à l'examen avec le build qui y est rattaché, la pré-version Linux devient
une version pleine. Rien n'est reconstruit, donc rien ne change entre ce qui a
été testé et ce qui est publié. **Windows fait exception** — le Microsoft Store
veut le paquet à chaque soumission.

## Les cinq workflows

| Workflow | `targets` | Destinations |
|----------|-----------|--------------|
| `desktop.yml` | `macos` `windows` `linux` | Mac App Store · Microsoft Store (MSIX) · Release GitHub + auto-update |
| `mobile.yml` | `android` `ios` | Play `com.tentacletv.mobile` · App Store `com.tentacle.mobile` |
| `tv.yml` | `androidtv` `appletv` | Play (MÊME fiche que le mobile, form factor TV) · App Store tvOS |
| `webos.yml` | — (IPK seul, pas d'entrée) | Release GitHub — adresse permanente `webos-latest` |
| `server.yml` | — (image seule, pas d'entrée) | `ghcr.io/knaox/tentacle-tv` + Release `server-vX.Y.Z` |

Les tags `<plateforme>-vX.Y.Z` restent acceptés comme déclencheurs et valent le
cran `store`. C'est la CI qui les pose quand on demande une version : elle écrit
`versions.json`, aligne le `package.json` de la cible, commite, tague, pousse.
Le suffixe `-rN` reste la re-livraison d'une même version marketing.

⚠️ **Le serveur ne part plus au push.** `git push origin main` ne déploie rien :
il faut le cran `store` de `server.yml`. Le cran `test` permet d'éprouver une
image (`:vX.Y.Z`) sans que la production, qui suit `:latest`, la prenne.

## Ce qui garde les livraisons

Quatre gardes, dans l'ordre où elles mordent :

1. **`.githooks/pre-push`** refuse un push dont le typecheck ou les tests
   échouent, AVANT qu'il parte. Il ne contrôle que les paquets touchés et ceux
   qui en dépendent (sélecteur pnpm `...[ref]`). Il vit dans le dépôt, donc il
   voyage avec lui et avec Syncthing ; `pnpm install` pose `core.hooksPath`.
   Échappatoire : `TENTACLE_SKIP_HOOK=1` ou `--no-verify`.
2. **`quality.yml`** rejoue le même contrôle sur GitHub, et
   `.github/actions/require-quality` **refuse de livrer** un commit sans run
   vert. C'est ce qui rattrape un `--no-verify`. Un run en cours est attendu,
   pas refusé.
3. **Le pré-vol** (`check-changelog.mjs`) exige le bloc `## [X.Y.Z]` de la
   version livrée, non vide dans les deux langues, AVANT le moindre build. Il
   avertit aussi, sans bloquer, quand la coupe à la puce va mordre.
4. **Le SHA figé.** Le job `prepare` publie un `sha` que TOUS les jobs
   checkout — y compris ceux qui attendent trente-cinq minutes (`*-attach`) et
   ceux qui écrivent le manifeste. Une retouche de changelog poussée pendant un
   run ne peut pas partir au store.

## Notes de version — `changelogs/`

Un fichier par domaine. Blocs :

```markdown
## [1.12.0]
### FR
- …
### EN
- …
```

Sans `### EN`, la section FR sert aux deux langues. Le markdown est converti en
texte brut pour les stores.

| Cible | Champ rempli | Limite |
|-------|--------------|--------|
| Apple (mac/iOS/tvOS) | « Nouveautés » + « À tester » | 4000 car. |
| Microsoft Store | « Nouveautés de cette version » (fr-fr + en-us) | 1500 car. |
| Google Play | « Nouveautés » (fr-FR + en-US) | **500 caractères Unicode** |
| Release GitHub | corps de la release (markdown) | — |

⚠️ La limite Play est en **caractères**, pas en octets : les notes TV 1.3.0 font
495 caractères pour 518 octets et passent. Play rejette la release ENTIÈRE au
lieu de couper — d'où l'absence de saut de ligne final.

**Blocs par canal** : `## [mac-X.Y.Z]` et `## [win-X.Y.Z]` remplacent le bloc nu
pour ces cibles-là. Deux usages : des notes Apple plus génériques, et surtout un
texte plus court pour le Microsoft Store, dont le bloc nu dépasse régulièrement
1500 caractères.

## Deux fiches partagées, deux pièges

- **macOS + iOS + tvOS** partagent la fiche App Store Connect
  `com.tentacle.mobile`. Toute recherche de build exige le TRIPLE filtre
  `version` + `preReleaseVersion.version` + `preReleaseVersion.platform` : un
  même numéro de build peut exister sur trois plateformes.
- **Android TV + Android mobile** partagent la fiche Play
  `com.tentacletv.mobile`. Les pistes par form factor sont PRÉFIXÉES dans l'API
  (`tv:Alpha` ≠ `alpha`, homonymes dans l'UI de la console) — le workflow
  « Play — lister les pistes » (`play-tracks.yml`) donne les identifiants exacts,
  et `play-publish.mjs` refuse une piste inconnue en listant celles qui existent.
  Le versionCode TV vaut `2e9 + build`. Les deux workflows partagent un groupe de
  concurrence : deux éditions Play concurrentes s'invalident l'une l'autre.

## Le manifeste d'auto-update

`updates/store-versions.json`, lu par l'app (`apps/web/src/lib/storeVersions.ts`).
Chaque bloc appartient au job de sa cible (`patch-store-manifest.mjs --only=…`) :

| Bloc | Qui l'écrit |
|------|-------------|
| `linux` | `desktop.yml`, job `manifest`, au cran store |
| `microsoftStore` | `desktop.yml`, job `manifest-stores` |
| `playMobile` / `playTv` | `mobile.yml` / `tv.yml`, job `play` |
| `macAppStore` | **`store-watch.yml` seul** (cron 30 min) |

Le bloc macOS est délibérément hors du run : entre la soumission et
l'approbation d'Apple il s'écoule des heures, et l'annoncer tout de suite faisait
pointer la pop-up de mise à jour vers une version introuvable. Le veilleur
rattrape aussi les blocs Play, mais seulement s'ils divergent de `versions.json`
— rien à détecter, aucun appel à Play.

## Réglages de console à vérifier une fois

Trois choses peuvent annuler l'automatisation sans la moindre erreur visible :

- **Play — « Publication gérée » doit être DÉSACTIVÉE.** Sinon tout reste en
  « Prêt à publier » et attend un clic, malgré `status: completed`.
- **App Store Connect — un groupe de test EXTERNE** doit exister par plateforme
  (secrets `ASC_BETA_GROUP_ID`, `ASC_BETA_GROUP_MACOS_ID`,
  `ASC_BETA_GROUP_TVOS_ID`). Sans lui, le cran test échoue en listant les groupes.
- **App Store Connect — métadonnées complètes** (captures, classification,
  conformité chiffrement) : `reviewSubmissions` refuse une version incomplète,
  exactement comme la console.

## Pré-requis / assets de signature (secrets GitHub)

| Plateforme | Assets | Statut |
|-----------|--------|--------|
| macOS | Apple Distribution + Mac Installer Distribution + profil MAS | ✅ en place |
| Windows Store | `PARTNER_TENANT_ID` / `PARTNER_CLIENT_ID` / `PARTNER_CLIENT_SECRET` | ✅ en place |
| Apple TV | cert Apple Distribution + profil tvOS (`TVOS_PROVISIONING_PROFILE_BASE64`) | ✅ en place |
| Android (TV + mobile) | keystore d'upload `MOBILE_*` + `PLAY_SERVICE_ACCOUNT_JSON` | ✅ en place |
| Apple (commun) | `APPLE_API_KEY` / `APPLE_API_ISSUER` / `APPLE_API_KEY_CONTENT` | ✅ en place |
| Groupes TestFlight | `ASC_BETA_GROUP_ID` / `_MACOS_ID` / `_TVOS_ID` | ⚠️ à poser |

> macOS embarque libmpv/FFmpeg recompilés **LGPL** (sandbox App Store). Détails
> build : `apps/desktop-electron/scripts/build-mpv-lgpl-macos.sh`. Voir aussi
> `docs/RELEASE.md`. Conformité chiffrement déclarée exemptée
> (`ITSAppUsesNonExemptEncryption=false`).
