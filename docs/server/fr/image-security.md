# Sécurité de l'image : signature, SBOM, durcissement

Chaque image publiée sur `ghcr.io/knaox/tentacle-tv` (à partir de la version
qui livre cette page) est :

- **contrôlée** avant qu'aucune étiquette ne la désigne — une vulnérabilité
  CRITICAL ou HIGH corrigeable arrête la livraison ;
- **signée** par [Sigstore cosign](https://docs.sigstore.dev/) en mode
  *keyless* : aucune clé à croire, la signature prouve que l'image vient du
  workflow `server-image.yml` du dépôt `Knaox/Tentacle-TV`, et elle est inscrite
  au journal public Rekor ;
- livrée avec son **SBOM** (inventaire des composants, SPDX), attaché à chaque
  image d'architecture comme attestation signée.

Les images publiées avant cette version ne sont pas signées.

## Vérifier qu'une image est authentique

Installer [cosign](https://docs.sigstore.dev/cosign/system_config/installation/) (v2.4 ou plus), puis :

```bash
cosign verify ghcr.io/knaox/tentacle-tv:latest \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/Knaox/Tentacle-TV/\.github/workflows/server-image\.yml@refs/(heads/(main|dev)|tags/(server|webos)-v[0-9.]+)$'
```

`Verified OK` suivi d'un bloc JSON : l'image est celle que le projet a
construite. Toute autre réponse (pas de signature, autre identité) : ne pas la
lancer. Pour vérifier exactement ce qui tourne, vérifier l'empreinte
(`ghcr.io/knaox/tentacle-tv@sha256:…`) plutôt qu'une étiquette, qui bouge.

Le SBOM se lit par `cosign verify-attestation --type spdxjson` sur l'empreinte
d'une image d'architecture — voir la [page anglaise](../image-security.md).

## Durcissement facultatif du conteneur

L'image démarre en root le temps de rendre le dossier de données à
`PUID:PGID` (un volume créé par une image d'avant appartient à root), puis
lance le serveur sous cet utilisateur (`su-exec`) ; rien d'autre ne tourne en
root. Les deux fichiers compose portent un bloc commenté qui va plus loin :
système de fichiers en lecture seule (`read_only: true` + `tmpfs` sur `/tmp` —
**le volume de données est alors obligatoire**), `no-new-privileges`, et
`cap_drop: [ALL]` avec les quatre capacités qu'exige le démarrage (`CHOWN`,
`DAC_OVERRIDE`, `SETUID`, `SETGID`).

Ou sans root du tout : `user: "1000:1000"` (votre `PUID:PGID`). Le dossier de
données doit alors déjà appartenir à cet utilisateur — sur un volume créé par
une image d'avant la 1.25, lancer d'abord le conteneur une fois sans `user:`.
