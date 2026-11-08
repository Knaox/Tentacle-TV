# Fonctions communes des bancs : écran déverrouillé + verrou d'écran du lot.
# Sourcé par scripts/banc-socle*.sh. Le nettoyage (rmdir) n'est armé qu'APRÈS la prise du
# verrou : tuer un banc qui attend ne retire jamais le verrou d'une autre session.
screen_locked() { ioreg -n Root -d1 -a 2>/dev/null | grep -A1 CGSSessionScreenIsLocked | grep -q true; }
take_screen_lock() {  # $1 = dossier du verrou
  while true; do
    if screen_locked; then echo "écran verrouillé, j'attends…" >&2; sleep 10; continue; fi
    mkdir "$1" 2>/dev/null && break
    echo "verrou d'écran pris, j'attends…" >&2; sleep 5
  done
  # Re-vérifie : si l'écran s'est verrouillé entre-temps, rendre la main.
  if screen_locked; then rmdir "$1"; take_screen_lock "$1"; fi
}
