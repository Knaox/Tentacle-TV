# Banc des droits — preuve de bout en bout (chantier Filtrage)

Un compte dont la politique Jellyfin interdit un titre ne le voit par AUCUNE route du cœur
(docs/DROITS-UTILISATEURS.md § 5 et § 7). Jamais lancé par `pnpm test`. Jamais contre le
Jellyfin réel (dev et prod le partagent) : tout se passe sur un Jellyfin JETABLE.

```bash
B=/chemin/vers/un/dossier-d-etat            # hors du dépôt
bash apps/backend/test/droits/banc/jellyfin.sh "$B"            # Jellyfin 10.11 jetable :18121
cd apps/backend
node "$(node -p 'require.resolve("tsx/cli")')" test/droits/banc/seed.cts "$PWD" "$B/data" "$B"
# backend du banc sur :3131 (env : PORT, TENTACLE_DATA_DIR=$B/data, DATABASE_URL vide)
node test/droits/banc/mint.cjs "$PWD" "$B/data" "$(cat "$B/jf/enfant-id")" > "$B/tokens.json"
BANC_URL=http://127.0.0.1:3141 node test/droits/banc/probe.mjs "$B"   # « AUCUNE FUITE », sinon chaque fuite nommée
```

- `jellyfin.sh` : films factices G, PG-13, R, sans note, G étiqueté « interdit » (Films) et
  G (Docs) ; comptes `enfant` (PG max, non classés et « interdit » bloqués) et `filmsseuls`.
- `seed.cts` : base d'un backend neuf, installé, branché sur ce Jellyfin.
- `mint.cjs` : un jeton de TV jumelée et un « voir en tant que » pour `enfant` (processus à
  part du backend : jamais `node:sqlite` dans le processus qui a Prisma ouvert).
- `probe.mjs` : listes, recherche, recos, Affiner (aucune fuite par id ni par nom), fiche,
  PlaybackInfo, flux, manifeste, trickplay, héros (404), segments (vides) — pour chacun des
  trois jetons ; témoin : le titre permis reste lisible. Puis les PLAGES HORAIRES : une plage
  qui exclut l'instant est posée sur `enfant` (Jellyfin jetable), tout doit répondre 403 après
  la relecture de la politique (30 s), puis elle est retirée (et la sonde attend encore 30 s).

Relevé du 2026-10-15, étape 3 (socle A fusionné, backend sur :3141 — le 3131 était pris par le
banc d'une autre session) : aucune fuite, hors plage 403 partout (TV et jeton Jellyfin).
Relevé du 2026-10-15 (branche Filtrage, avant le socle) : aucune fuite sur les trois jetons ;
même sonde au jeton administrateur → « Adulte Rouge » partout (la sonde voit une fuite) ;
`filmsseuls` face à « Doc Prive » : flux, héros, trickplay 404, recherche vide. Limite hors de
portée de Tentacle : Jellyfin en DIRECT sert le fichier à qui connaît son id (206).

Arrêt : `docker rm -f droits-filtrage-jf && docker volume rm droits-filtrage-jf-config
droits-filtrage-jf-cache droits-filtrage-jf-media`, puis arrêter le backend par son PID.
