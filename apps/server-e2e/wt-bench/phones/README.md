# Téléphones du banc Watch Together (iPhone simulé + émulateur Android)

Outils du testeur mobile pour rejouer Watch Together sur les VRAIES apps, sans un geste à l'écran :
tout passe par Hermes (CDP de Metro). Backend et Jellyfin jetable : `bench:wt up` (ports surchargés
par `WT_BACKEND_PORT`, `WT_WEB_PORT`), Metro du worktree sur `WT_METRO_PORT`.

```bash
# session posée (iPhone : manifeste AsyncStorage ; Android : base RKStorage par run-as)
npx tsx wt-bench/phones/session.ts ios <udid> a "WT banc iPhone (Testeur)"
npx tsx wt-bench/phones/session.ts android emulator-5580 b "Pixel banc"
# lire / toucher
npx tsx wt-bench/phones/drive.ts iPhone texts|labels
npx tsx wt-bench/phones/drive.ts sdk_gphone press-label Accepter
# chronologie (sonde __wtBench toutes les ~200 ms) avec gestes datés, sur la même session CDP
npx tsx wt-bench/phones/timeline.ts 70 iPhone sdk_gphone --do "5:sdk_gphone:press-label:Accepter" > a.jsonl
```

Pièges : Metro n'accepte qu'UN client CDP par appareil (un second reste muet 8 s) — d'où les gestes
dans `timeline.ts`. La feuille Watch Together se ferme/ouvre par le module `wtSheets`
(`drive.ts … eval` : `__r(id).closeWtSheet()`). Ne jamais `bench:wt down` si `wtbench-jf` est
partagé avec d'autres sessions.
