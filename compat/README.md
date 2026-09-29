# Compatibilité Jellyfin

`jellyfin.json` dit ce que Tentacle **sait** de chaque version de Jellyfin :
une suite de tests l'a éprouvée (`pnpm test:jellyfin-compat -- --version <v>`),
fonctionnalité par fonctionnalité. Rien n'y est deviné.

- **Schéma et lecture** : `packages/shared/src/jellyfinCompat/compatManifest.ts`
  (miroir octet pour octet dans `apps/backend/src/services/jellyfinCompat/`).
- **Verdict d'une version** : `compatVerdict.ts`, à côté.
- **Rapports bruts** d'un run : `reports/jellyfin-<version exacte>.json`.

## Où il sert

Le serveur l'embarque (`COPY compat/jellyfin.json` du Dockerfile) : le verdict
est connu hors ligne. Il relit aussi
`https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/compat/jellyfin.json`
et garde la révision la plus haute des deux : **pousser ce fichier sur `main`
publie un verdict nouveau à tous les serveurs, sans nouvelle version**.

L'administration (vue d'ensemble, Services) compare au manifeste la version de
Jellyfin installée ET la dernière publiée sur GitHub, puis confirme sur le
serveur connecté, par son document OpenAPI, les `endpoints` que déclare chaque
fonctionnalité.

## Règles

1. `revision` monte de 1 à **chaque** publication. Un serveur refuse une
   révision plus basse ou égale à la sienne — et tout manifeste qui a UNE faute.
2. `versions[].version` = la version exacte de `/System/Info` (« 12.1.0 »).
3. Verdict global = celui que la règle tire des fonctionnalités (un test le
   vérifie) : `fail` si une fonctionnalité `critical` échoue, `partial` si une
   seule n'est pas `ok` (`unsupported` compris), `ok` sinon.
4. Fonctionnalité absente d'une version : **sans objet** si `since` est plus
   récent, sinon **non testée** (non comptée).
5. Une version non testée d'une lignée (`lines`) où une sœur est `ok` ou
   `partial` s'affiche « Compatible, non testée », d'après cette sœur.
6. Un endpoint n'est déclaré que s'il figure dans le document OpenAPI de chaque
   version où la fonctionnalité est `ok` (celui de 12.1 omet les routes HLS).
7. `minTentacle` (facultatif) : le verdict ne vaut qu'à partir de ce serveur
   Tentacle ; un serveur plus ancien le dit à l'administrateur.
