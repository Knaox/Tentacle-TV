# Fork vendored de tauri-plugin-libmpv

- **Upstream** : [nini22P/tauri-plugin-libmpv](https://github.com/nini22P/tauri-plugin-libmpv) v0.3.2 (MPL-2.0 — licence conservée, voir LICENSE).
- **Raison du fork** : l'upstream protège toutes ses instances mpv par un unique
  `Mutex<HashMap<label, MpvInstance>>` **tenu pendant les appels FFI bloquants**
  (`with_instance`, et `init` pendant tout `mpv_wrapper_create`), et prend ce
  même mutex **sur le thread principal** dans `on_event CloseRequested`.
  Conséquence, capturée en prod (Tentacle 1.12.0) le 15.07.2026 par
  `win_freeze_probe` : une commande coincée dans mpv (teardown réseau sans fin)
  garde le mutex → 89 threads tokio empilés → clic ✕ → thread UI endormi dans
  la wndproc → **gel total de l'app** (le film continue, plus aucun clic).

## Modifications par rapport à l'upstream

| Fichier | Changement |
|---------|-----------|
| `src/instances.rs` | **Nouveau** — `InstanceMap` (verrou de map jamais tenu pendant la FFI) + `InstanceSlot` (`RwLock` par instance : ops en `read()` concurrentes, destroy en `write()`), `contains_nonblocking` pour le thread UI. |
| `src/lifecycle.rs` | **Nouveau** (extrait de desktop.rs, règle 300 lignes) — `init` : réservation du label sous verrou court, `mpv_wrapper_create` HORS verrou ; `destroy` : retrait de map puis attente `write()` sur CE slot uniquement (auto-réparateur : démonte le zombie dès que l'op coincée lâche). Corrige aussi le `Box::from_raw` sous mauvais type du chemin d'échec d'init, et l'usage de références au userdata dans une tâche `'static` du callback d'événements. |
| `src/desktop.rs` | Réécrit — struct + ops FFI via `with_instance` (clone d'`Arc` sous verrou court puis `read()` du slot), factorisation `decode_ffi_response`. |
| `src/lib.rs` | `on_event CloseRequested` : `contains_nonblocking` au lieu de `lock()` — le thread principal ne peut plus s'endormir sur le mutex. |
| `src/commands.rs` | `init` passe par `spawn_blocking` (comme destroy/command/…). |

Fichiers JS/CI du paquet npm retirés (`package.json`, `pnpm-lock.yaml`,
`rollup.config.js`, `tsconfig.json`, `.github`, `Cargo.lock`) — seul le crate
Rust est consommé (path dependency). L'API frontend (`invoke('plugin:libmpv|…')`)
et la DLL `libmpv-wrapper` sont **inchangées** (ABI identique).

## Politique de maintenance

- Si un fix officiel équivalent sort upstream : comparer, et re-basculer sur la
  version crates.io si elle garantit (1) aucun verrou tenu pendant la FFI,
  (2) aucun verrou bloquant sur le thread principal.
- Toute montée de version upstream se fait par re-copie + ré-application des
  changements ci-dessus (le tableau fait foi).
