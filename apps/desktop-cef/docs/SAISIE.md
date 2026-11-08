# Saisie : clavier et raccourcis, CEF contre Electron (macOS)

Banc : `scripts/banc-saisie.sh [build] [cas…|connexion]` (DevTools 9314, verrou d'écran : SDL3
jette les touches d'une fenêtre inactive, donc la fenêtre doit avoir le focus). Les touches sont de
VRAIS `NSEvent` postés dans l'app (`--debug-input`, `shell.debug.native`) : AppKit → SDL3 → socle →
CEF → page, jamais des évènements CDP. Les caractères des touches imprimables viennent de la
disposition ACTIVE du Mac (`UCKeyTranslate`) : ici **suisse romand (QWERTZ)**, celle de Damien.
Page : `tests/saisie/page.html` (journal keydown/keypress/keyup) ; Entrée sur la vraie page de
connexion du banc : `tests/saisie/connexion.mjs`.

## Référence

- **Évènements DOM** : Chromium Mac standard (donc Electron) — `key`/`code` (`ui/events/keycodes/dom`),
  `keyCode` (`KeyboardCodeFromNSEvent`), `keypress` seulement pour un caractère, Entrée comprise
  (Chromium synthétise CHAR `\r` après `insertNewline:`), aucun pour Tab, Échap, flèches,
  Retour arrière, Suppr, Début/Fin/PgPréc/PgSuiv, F1–F12.
- **Raccourcis d'application** : le bureau Electron 1.42.0, lu dans Tentacle-TV
  `apps/desktop-electron/src/main/` : `menu.ts` (macOS : menu Application avec about, services,
  hide ⌘H, hideOthers ⌥⌘H, unhide, quit ⌘Q ; `editMenu` ; `windowMenu` : Réduire ⌘M, Zoom,
  plein écran ⌃⌘F), `fullscreenSync.ts` (F11 bascule le plein écran AVANT la page, sort aussi du
  plein écran du document), `ipc/mediaKeys.ts` + `apps/web/src/hooks/useSmtc.ts` (touches média
  par `globalShortcut`, mais `smtcEnabled()` n'est vrai que sous **Windows**). Pas de ⌘W (le rôle
  `windowMenu` macOS n'a pas « Fermer »), pas de ⌘, (aucun Réglages), pas de ⌘±/0 (aucun menu
  Affichage).
- Ordre d'un raccourci ⌘/⌃, comme Electron : la page reçoit d'abord le keydown ; s'il n'est pas
  consommé (`preventDefault`), il part aux menus (`CefKeyboardHandler::OnKeyEvent` → menus,
  `docs/INTERFACES.md`, « Saisie et raccourcis »).

## Résultats (04/11, build `saisie`)

« Premier audit » : premier passage du banc complet, Entrée et menus déjà en place. Sans menus
(`3b8e1a3`), ⌘Q/⌘H/⌘M/⌃⌘F ne font rien : aucun `NSMenu` (SDL3 ne crée pas ses menus quand
`NSApp` existe déjà) — lu dans le code, le banc complet ne tourne pas sur ce build (injection plus
ancienne).

| Cas | Premier audit (29/39) | Final | Correctif |
|---|---|---|---|
| **Entrée sur la page de connexion** (vrai formulaire, profil neuf) | ❌ AVANT correctif (`3b8e1a3`) : reste sur `/login`, keydown/keyup Enter 13, **aucun keypress** | ✅ connecté (`/`) : keydown → keypress Enter 13 → keyup | CHAR `\r` après RAWKEYDOWN (`input.cpp`) |
| Entrée (formulaire) / Entrée du pavé | ✅ (correctif déjà là) | ✅ `Enter/Enter/13` et `Enter/NumpadEnter/13`, keypress c13, envoi = 1 | idem |
| Tab / Maj+Tab | ✅ | ✅ `Tab/Tab/9` (+shift), focus a→b / b→a, pas de keypress | — |
| Échap | ✅ | ✅ `Escape/Escape/27` | — |
| Flèches | ✅ | ✅ 37/38/39/40, curseur déplacé | — |
| Espace | ✅ | ✅ `" "/Space/32`, keypress c32 | — |
| Retour arrière / Suppr (fn+⌫) | ✅ | ✅ `Backspace/8`, `Delete/46` | — |
| Début/Fin/PgPréc/PgSuiv | ✅ | ✅ 36/35/33/34 | — |
| F (plein écran du lecteur) | ✅ | ✅ `f/KeyF/70`, keypress c102 | — |
| F1–F10, F12 | ✅ | ✅ `F1/F1/112` … `F12/F12/123` | — |
| Maj seule | ✅ | ✅ `Shift/ShiftLeft/16` | — |
| Répétition (touche maintenue) | ❌ `repeat` toujours faux | ✅ keydown et keypress `repeat=true` | voir écarts (script injecté) |
| Disposition active (QWERTZ) | ✅ | ✅ touche Z ANSI → `y/KeyZ/89`, valeur « y » | — |
| ⌥G (« @ » en suisse romand) | ✅ | ✅ « @ » | — |
| ⌥←/→, ⇧⌥←, ⌥⌫ (mot) | ✅ | ✅ (Blink les connaît) | — |
| ⌘←/→, ⇧⌘←, ⌘⌫ (ligne) | ❌ sans effet | ✅ curseur 0 / 13, sélection 0-13, effacement | `Selection.modify` si la page ne consomme pas (`shell_shortcuts.cpp`) |
| ⌘A, ⌘C, ⌘V, ⌘X | ✅ | ✅ par le menu Édition | menu Édition, après la page |
| ⌘Z / ⇧⌘Z | ❌ faux négatif du banc (touche Z ANSI = « y » en QWERTZ) | ✅ « » puis « sa » | idem |
| Touche morte ^ puis e | ❌ faux négatif du banc (évènement posté irréaliste) | ✅ « ê » | — |
| IME (composition, validation) | ✅ « 日本 » | ✅ validé par `ImeCommitText` | — |
| Entrée pendant une composition IME | ❌ 2 envois (texte validé envoyé en CHAR sur la touche Entrée) | ✅ aucun envoi | touches réservées à l'IME pendant la composition |
| ⌘Q | ✅ | ✅ l'app se ferme | barre de menus (`shell_menu_mac.mm`) |
| ⌘W | ✅ rien | ✅ rien, keydown vu par la page | comme Electron |
| ⌘, | ✅ rien | ✅ rien, keydown vu | comme Electron |
| ⌘+ / ⌘- / ⌘0 | ✅ pas de zoom | ✅ `devicePixelRatio` inchangé | comme Electron |
| ⌘M | ✅ | ✅ fenêtre réduite | menu Fenêtre |
| ⌘H | ✅ | ✅ app masquée | menu Application |
| ⌃⌘F | ❌ faux négatif du banc (fenêtre plus clé après ⌘H) | ✅ plein écran puis fenêtré | menu Fenêtre |
| F11 | ❌ idem | ✅ plein écran puis fenêtré, la page ne la voit pas | `Shell::interceptKey` |
| Touche média lecture/pause | ✅ rien | ✅ rien dans la page | comme Electron sur macOS |
| Socle (souris, frappe, ⌘K, ⌘A/C/V, IME + fenêtre de candidats) | ✅ | ✅ 9/9 | non-régression |

## Écarts restants avec Electron, et pourquoi

- **`repeat`** : CEF macOS reconstruit chaque touche hors écran en `NSEvent … isARepeat:NO` et perd
  `EVENTFLAG_IS_REPEAT`. Un script injecté avant la page (`builtin_handlers.cpp`) marque `repeat`
  sur un keydown d'une touche déjà enfoncée (et sur son keypress). Même résultat pour la page ; vrai
  correctif = CEF.
- **keyup des raccourcis ⌘** : AppKit ne livre pas le keyUp d'une touche tapée avec ⌘ à Chromium ;
  SDL3 le lit avant AppKit, la page reçoit donc ce keyup. Inoffensif.
- **Composition IME / touche morte** : Chromium envoie à la page un keydown `keyCode 229`
  (`isComposing`) pour les touches prises par l'IME ; nous n'en envoyons aucun (CEF ne sait pas
  marquer `isComposing`). La page ne réagit donc à aucune touche pendant une composition.
- **⌘←/→/⌫** : rejoués par `Selection.modify` plutôt que par les commandes d'édition natives
  (absentes en hors écran) ; ⌃A/⌃E (raccourcis emacs) ne sont pas couverts.
- **Menu Édition** : sans le sous-menu « Parole » que le rôle `editMenu` d'Electron ajoute.
  Libellés en français écrits en dur (Electron : ceux de ses rôles).
- **Touches média** : sans effet, comme Electron sur macOS (le front ne les écoute que sous
  Windows). Les brancher (MPRemoteCommandCenter) demanderait un correctif du front
  (`useSmtc.ts`) : hors parité, non fait.
- **AZERTY** : non testé en vrai — changer la disposition du Mac est un réglage système. Le banc
  tourne sur la disposition active (suisse romand) ; le chemin (caractères via la disposition de
  SDL3, `code` via le kVK) est le même pour toute disposition.
