#!/bin/zsh
# pick.sh <appareil> <profil> : attend « Qui regarde ? » (ou l'écran d'adresse), ouvre le profil, ferme l'accueil guidé
D="$(dirname "$0")/d.sh"; dev=$1; prof=$2
for i in $(seq 1 40); do t=$($D $dev texts 2>/dev/null); echo "$t" | grep -q "Qui regarde\|Welcome\|Bienvenue" && break; sleep 3; done
if echo "$t" | grep -q "Welcome\|Bienvenue"; then $D $dev type "tentacle.example" "http://127.0.0.1:3731" >/dev/null; $D $dev press-exact Continue >/dev/null; $D $dev press-exact Continuer >/dev/null; for i in $(seq 1 20); do $D $dev texts | grep -q "Qui regarde" && break; sleep 3; done; fi
$D $dev press-label "Ouvrir le profil $prof"; sleep 4
for b in Continuer Terminer Passer; do $D $dev labels | grep -q "\"$b\"" && $D $dev press-label $b >/dev/null && sleep 2; done
$D $dev press-exact "Configurer plus tard" >/dev/null
$D $dev labels | grep "profil actuel"
