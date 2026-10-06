# Le service de test d'ouverture (mainteneurs)

*English version: [../port-check.md](../port-check.md).*

`apps/port-check` est le service externe qu'appellent les serveurs Tentacle pour **Administration › Accès à
distance › Lancer le test**. **Aucun workflow ne le construit ni ne le déploie** : il se déploie à la main, sous
`check.tentacletv.app` (nom à confirmer). Tant qu'il n'est pas en ligne, les serveurs disent « service
indisponible » — jamais « fermé ».

## Ce qu'il garantit

- `POST /v1/check` ne teste **que l'adresse du demandeur** (IPv4 ou IPv6, celle de sa connexion) ; aucune
  adresse cible n'est acceptée. Un domaine n'est suivi que s'il désigne cette même adresse.
- Ports : 80, 443, 3000, 8096, 8920 et 1024–49151 ; quatre cibles par demande au plus.
- GET seul, 5 s par cible, aucune redirection suivie, 4 Ko lus au plus ; seul un verdict structuré revient.
- Défis à usage unique (un rejeu est refusé), débit borné par adresse (par /64 en IPv6), sources privées ou
  réservées refusées (`source_not_public`), **aucune adresse IP dans les journaux**.
- Protocole : `apps/port-check/src/checkProtocol.ts`, miroir de
  `packages/shared/src/remoteAccess/checkProtocol.ts`.

## Construire et lancer

```bash
docker build -f apps/port-check/Dockerfile -t tentacle-port-check .
docker run -d --restart unless-stopped -p 8080:8080 tentacle-port-check
```

Distroless, sans root, un seul fichier empaqueté (~213 Mo décompressés, Node pour l'essentiel). Variables :
voir `apps/port-check/README.md` (`PORT`, `HOST`, `TRUSTED_PROXIES`, `CHECKS_PER_WINDOW`, `WINDOW_MS`,
`PROBE_TIMEOUT_MS`, `MAX_IN_FLIGHT`).

## Liste de déploiement

1. Un hôte avec **IPv4 et IPv6 publiques** (le service ne teste l'IPv6 que s'il en a lui-même).
2. DNS : enregistrements `A` **et** `AAAA` pour le nom du service.
3. HTTPS devant (Caddy, par exemple) — puis `TRUSTED_PROXIES` réglé sur l'adresse du mandataire, sinon chaque
   demande semble venir de lui.
4. Jamais `ALLOW_NON_PUBLIC_SOURCES=true` en production (bancs locaux seulement).
5. Faire pointer les serveurs vers lui : `REMOTE_CHECK_URL=https://check.tentacletv.app` (c'est le défaut).
6. Essai depuis un serveur : **Administration › Accès à distance › Lancer le test**.
