# À essayer sur une vraie machine Windows

Une ligne par cas : geste, puis ce qui est attendu. Chaque axe tient sa section.

## reseau (pochettes, greffons, CSP, relais, requêtes déléguées, préchargement)

- Compilé par mingw-w64 seulement (`tools/net-windows-syntax.sh`) : rien n'a encore tourné sous Windows — tout ce qui suit est à voir une première fois.
- `pnpm dev:cef`, Octave ouvert → pochettes affichées ; `%APPDATA%\com.tentacle.media\octave-art\` se remplit ; relancé, pochettes servies du disque (`X-Octave-Art: disk`).
- Un nom d'utilisateur Windows avec accents → le dossier de données est le bon (`%APPDATA%` lu en large) et le cache s'écrit.
- Les tests de la partie pure, construits par MSVC : `ctest --test-dir <build>\src\net` → tous verts (dates de fichier par `GetFileAttributesExW`/`SetFileTime`).
- Page d'une extension → chargée sous `tentacle://plugin/<id>`, sans violation de CSP de l'application.
- Sillon, titre « direct » → joue par `http://127.0.0.1:<port>/d/…` (Winsock) ; pare-feu Windows : aucune invite (écoute sur la boucle locale seulement).
- Lecture directe Jellyfin → reports de lecture relayés (`reseau.debug.trace`), position gardée.
- Fiche d'un film → `[reseau] préchargement …` dans la sortie.
