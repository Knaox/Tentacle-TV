#!/usr/bin/env bash
# Mesure un paquet .app comme le voit l'utilisateur : taille réelle, taille sur disque une
# fois installé (compression APFS, comme l'App Store), et ce qu'il télécharge (zip, DMG, pkg).
# Usage : scripts/paquet-mesure.sh <App.app> [étiquette] [--arm64] [--detail]
#   --arm64  : mesure d'abord une copie amincie à arm64 (ditto --arch), pour comparer à
#              un paquet universel (Electron) à architecture égale.
#   --detail : ajoute la répartition par composant.
# Sorties de travail : $TENTACLE_CEF_CACHE/paquet/mesures/<étiquette>/ (effacées à chaque fois).
# Une ligne de résultat (Mo, base 2^20) : étiquette réel installé-compressé zip dmg-udzo dmg-ulmo pkg
# (« réel » = somme des tailles ; du sur une copie ne le donne pas : ditto garde la compression APFS.)
set -euo pipefail
app="${1:?usage: $0 <App.app> [étiquette] [--arm64] [--detail]}"; shift
label="$(basename "$app" .app)"; arm64=0; detail=0
for a in "$@"; do
  case "$a" in --arm64) arm64=1 ;; --detail) detail=1 ;; *) label="$a" ;; esac
done
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
work="$cache/paquet/mesures/$label"
rm -rf "$work" && mkdir -p "$work"

mo() { awk -v b="$1" 'BEGIN { printf "%.1f", b / 1048576 }'; }
apparent() {  # somme des tailles de fichiers (liens symboliques exclus)
  find "$1" -type f -print0 | xargs -0 stat -f %z | awk '{ s += $1 } END { print s + 0 }'
}

src="$app"
if (( arm64 )); then
  src="$work/arm64/$(basename "$app")"
  mkdir -p "$work/arm64"
  ditto --arch arm64 --nohfsCompression "$app" "$src"
fi
# Copie de travail et copie compressée comme une installation App Store.
ditto --nohfsCompression "$src" "$work/brut/$(basename "$app")"
ditto --hfsCompression "$src" "$work/hfs/$(basename "$app")"
real=$(apparent "$work/brut")
hfs=$(( $(du -sk "$work/hfs" | cut -f1) * 1024 ))

ditto -c -k --keepParent "$work/brut/$(basename "$app")" "$work/app.zip"
hdiutil create -quiet -srcfolder "$work/brut" -volname "$label" -format UDZO -ov "$work/udzo.dmg"
hdiutil create -quiet -srcfolder "$work/brut" -volname "$label" -format ULMO -ov "$work/ulmo.dmg"
pkgbuild --quiet --component "$work/brut/$(basename "$app")" --install-location /Applications \
  "$work/app.pkg" >/dev/null
sz() { stat -f %z "$1"; }

printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$label" "$(mo "$real")" "$(mo "$hfs")" \
  "$(mo "$(sz "$work/app.zip")")" "$(mo "$(sz "$work/udzo.dmg")")" "$(mo "$(sz "$work/ulmo.dmg")")" \
  "$(mo "$(sz "$work/app.pkg")")" | tee "$work/resultat.tsv"

if (( detail )); then
  # Répartition : chaque fichier ≥ 256 Ko, puis les dossiers .lproj regroupés.
  b="$work/brut/$(basename "$app")"
  find "$b" -type f -size +256k -print0 | xargs -0 stat -f '%z %N' | sort -rn |
    awk -v p="$b/" '{ s = $1; $1 = ""; sub("^ ", ""); sub(p, ""); printf "%8.1f  %s\n", s / 1048576, $0 }'
  find "$b" -name '*.lproj' -type d | wc -l | awk '{ printf "%8s  dossiers .lproj : %d\n", "", $1 }'
fi
rm -rf "$work/arm64" "$work/hfs"
