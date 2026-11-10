# À essayer sur une vraie machine Linux

Une ligne par cas : geste, puis ce qui est attendu. Chaque axe tient sa section.

## reseau (pochettes, greffons, CSP, relais, requêtes déléguées, préchargement)

- `pnpm dev:cef` sur le profil d'Electron, Octave ouvert → les pochettes s'affichent ; `ls ~/.local/share/com.tentacle.media/octave-art/*/` (ou `$XDG_DATA_HOME/…`) liste les fichiers ; relancé, les pochettes reviennent sans réseau (`X-Octave-Art: disk` dans les DevTools).
- `XDG_DATA_HOME=/chemin/absolu pnpm dev:cef` → le cache `octave-art/` naît sous `/chemin/absolu/com.tentacle.media/`, jamais sous `~/.config`.
- Se déconnecter d'Octave → `octave-art/` disparaît (POST `tentacle://art/clear`).
- Ouvrir la page d'une extension (Vigie, Sillon) → elle se charge (iframe `tentacle://plugin/<id>`), aucune « violation de CSP » de l'application dans la console.
- Lire un film sur un serveur à lecture directe (adresse privée de Jellyfin réglée) → la position de reprise est gardée par Jellyfin (relais `jellyfin_session_post`) ; `__shell.invoke('reseau.debug.trace')` liste `PlaybackInfo`, `Sessions/Playing…`.
- Sillon : une recherche passe par l'appareil (`window.tentacle.invoke('client_fetch_log', {})` montre l'hôte, 200) ; un titre « direct » joue par `http://127.0.0.1:<port>/d/…` (`reseau.debug.directRelay` : `direct` > 0).
- Ouvrir la fiche d'un film → la sortie de l'app dit `[reseau] préchargement <id> : … Kio · … Kio`.
