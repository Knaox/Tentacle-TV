# Banc de la Famille — parents, membres mineurs, droits de création

Preuve de bout en bout du § 9.4 de docs/DROITS-UTILISATEURS.md, sur un Jellyfin 10.11
JETABLE (jamais le Jellyfin réel : dev et prod le partagent) et une base Tentacle jetable.
Jamais lancé par `pnpm test`.

```bash
B=/chemin/vers/un/dossier-d-etat            # hors du dépôt
bash apps/backend/test/famille-roles/banc/jellyfin.sh "$B"     # Jellyfin jetable :8914
cd apps/backend
node "$(node -p 'require.resolve("tsx/cli")')" test/famille-roles/banc/seed.cts "$PWD" "$B/data" "$B/jf"
PORT=3114 TENTACLE_DATA_DIR="$B/data" DATABASE_URL= REMOTE_CHECK_URL=off \
  node "$(node -p 'require.resolve("tsx/cli")')" src/index.ts &      # backend du banc
BANC_URL=http://127.0.0.1:3114 node test/famille-roles/banc/probe.mjs "$B"   # « TOUT EST PROUVÉ »
BANC_URL=http://127.0.0.1:3114 node test/famille-roles/banc/guet.mjs "$B"    # ~2 min : le guet
```

- `jellyfin.sh` : quatre films factices (G, PG-13, R, sans note) ; les comptes `proprio`,
  `coparent` et `ado` (base : PG-13 au plus, « gore » bloqué, une plage horaire).
- `probe.mjs` : un compte sans droit ne fonde pas de famille ni ne crée d'invité ;
  l'administrateur le lui permet ; `coparent` nommé parent pose sur `ado` un contrôle
  « ≤ 6 ans » ; sa politique RELUE dans Jellyfin est base ∩ voulu, rien d'autre n'a bougé ;
  Jellyfin filtre ses titres avec SON jeton ; retiré, la base est rendue à l'octet près
  (hors `Id` des plages, que Jellyfin renumérote) ; l'administrateur relève la note par
  Tentacle pendant le contrôle (la famille la recoupe), `ado` quitte la famille, sa base
  revient avec la note de l'administrateur ; un parent règle le contrôle et le PIN d'un invité.
- `guet.mjs` : un changement fait DIRECTEMENT dans Jellyfin devient la base, le guet repose
  le contrôle dessus (≤ 2 min) ; retiré, c'est cette base-là qui revient.

Relevé du 2026-10-15 : « TOUT EST PROUVÉ » (29 vérifications) ; guet en ~100 s.

Arrêt : `docker rm -f jf-famille && docker volume rm jf-famille-config jf-famille-cache
jf-famille-media`, puis arrêter le backend par son PID.
