#!/usr/bin/env bash
# Embarque dans <App>.app/Contents/Frameworks toutes les dylibs hors système dont dépend
# l'exécutable principal (libmpv, FFmpeg, libplacebo, SDL3…), plus le pilote Vulkan MoltenVK
# et son manifeste ICD, puis réécrit les chemins : l'app ne touche plus ni /opt/homebrew ni
# le cache de build. Les dylibs se désignent entre elles par @loader_path, l'exécutable par
# @rpath (= @executable_path/../Frameworks). Les liens absolus restants font échouer.
# Usage : embed-dylibs.sh <App.app> <exécutable> [dossier de recherche @rpath…]
# Compatible bash 3.2 (celui de macOS) : pas de tableaux associatifs.
set -euo pipefail
app="$1"; exe="$2"; shift 2
search=("$@" /opt/homebrew/lib)
fw="$app/Contents/Frameworks"
mkdir -p "$fw"
seen="$(mktemp)"; trap 'rm -f "$seen"' EXIT

is_system() { case "$1" in /usr/lib/*|/System/*) return 0 ;; *) return 1 ;; esac; }
# Dépendances non système d'un Mach-O (sans sa propre ligne d'identité).
deps_of() {
  local id; id="$(otool -D "$1" | sed -n 2p)"
  otool -L "$1" | tail -n +2 | awk '{print $1}' | while read -r d; do
    [[ "$d" == "$id" ]] && continue
    # Déjà dans le paquet : le framework CEF lié (@executable_path/../Frameworks/…), nos dylibs.
    case "$d" in @executable_path/*|@loader_path/*) continue ;; esac
    is_system "$d" || echo "$d"
  done
}
resolve() {  # chemin réel d'une dépendance (absolue ou @rpath/…)
  local d="$1" s
  case "$d" in
    @rpath/*) for s in "${search[@]}"; do
                [[ -e "$s/${d#@rpath/}" ]] && { realpath "$s/${d#@rpath/}"; return; }
              done
              echo "introuvable : $d" >&2; return 1 ;;
    @*) echo "chemin non géré : $d" >&2; return 1 ;;
    *) realpath "$d" ;;
  esac
}
rpaths_of() { otool -l "$1" | awk '/cmd LC_RPATH/ {getline; getline; print $2}'; }
drop_rpaths() {  # retire les LC_RPATH absolus hors système (Xcode, Homebrew, cache)
  rpaths_of "$1" | while read -r r; do
    case "$r" in /usr/lib/*|@*) ;; *) install_name_tool -delete_rpath "$r" "$1" 2>/dev/null ;; esac
  done
}
# Réécrit les dépendances d'un Mach-O vers le dossier Frameworks ; copie les nouvelles.
relink() {  # relink <fichier> <préfixe : @rpath ou @loader_path>
  local f="$1" pre="$2" d src name
  for d in $(deps_of "$f"); do
    src="$(resolve "$d")"
    name="$(basename "$(otool -D "$src" | sed -n 2p)")"
    [[ -n "$name" ]] || name="$(basename "$src")"
    install_name_tool -change "$d" "$pre/$name" "$f" 2>/dev/null
    if ! grep -qxF "$name" "$seen"; then
      echo "$name" >>"$seen"
      cp -f "$src" "$fw/$name" && chmod u+w "$fw/$name"
      install_name_tool -id "@rpath/$name" "$fw/$name" 2>/dev/null
      drop_rpaths "$fw/$name"
      relink "$fw/$name" @loader_path
    fi
  done
}

relink "$exe" @rpath
drop_rpaths "$exe"
# Les LC_RPATH seuls : un `otool -l | grep` voit aussi le chemin du framework CEF lié
# (@executable_path/../Frameworks/Chromium…), et l'app partait sans rpath (ne démarrait pas).
(( $(rpaths_of "$exe" | grep -cxF '@executable_path/../Frameworks') > 0 )) ||
  install_name_tool -add_rpath @executable_path/../Frameworks "$exe"

# MoltenVK : le chargeur Vulkan le trouve à l'exécution par un manifeste ICD. Sur macOS il
# cherche d'abord <bundle>/Contents/Resources/vulkan/icd.d ; chemin relatif au manifeste.
mvk="$(realpath /opt/homebrew/opt/molten-vk/lib/libMoltenVK.dylib)"
cp -f "$mvk" "$fw/libMoltenVK.dylib" && chmod u+w "$fw/libMoltenVK.dylib"
install_name_tool -id @rpath/libMoltenVK.dylib "$fw/libMoltenVK.dylib" 2>/dev/null
icd="$app/Contents/Resources/vulkan/icd.d"
mkdir -p "$icd"
cat >"$icd/MoltenVK_icd.json" <<'EOF'
{
    "file_format_version": "1.0.0",
    "ICD": {
        "library_path": "../../../Frameworks/libMoltenVK.dylib",
        "api_version": "1.4.0",
        "is_portability_driver": true
    }
}
EOF

# Garde-fou : plus aucun chemin absolu hors système dans les Mach-O embarqués.
bad=0
for f in "$exe" "$fw"/*.dylib; do
  if otool -L "$f" | tail -n +2 | awk '{print $1}' | grep -vE '^(/usr/lib/|/System/|@rpath/|@loader_path/|@executable_path/)'; then
    echo "  ↑ lien absolu restant dans $f" >&2; bad=1
  fi
done
# Garde-fou : chaque dépendance @rpath/@loader_path/@executable_path se résout comme dyld le
# ferait (rpaths de l'exécutable, hérités par les dylibs qu'il charge) vers un fichier présent.
macos="$(dirname "$exe")"
for f in "$exe" "$fw"/*.dylib; do
  id="$(otool -D "$f" | sed -n 2p)"
  while read -r d; do  # « Chromium Embedded Framework » : des espaces, d'où read
    [[ "$d" == @* && "$d" != "$id" ]] || continue
    ok=0
    case "$d" in
      @rpath/*) for r in $(rpaths_of "$exe") $(rpaths_of "$f"); do
                  r="${r/@executable_path/$macos}"; r="${r/@loader_path/$(dirname "$f")}"
                  if [[ -e "$r/${d#@rpath/}" ]]; then ok=1; fi
                done ;;
      @loader_path/*) if [[ -e "$(dirname "$f")/${d#@loader_path/}" ]]; then ok=1; fi ;;
      @executable_path/*) if [[ -e "$macos/${d#@executable_path/}" ]]; then ok=1; fi ;;
    esac
    (( ok )) || { echo "$(basename "$f") : $d ne se résout pas dans le paquet" >&2; bad=1; }
  done < <(otool -L "$f" | tail -n +2 | sed -E 's/^[[:space:]]+//; s/ \(compatibility version.*$//')
done
# Garde-fou : rien qui vise un macOS plus récent que l'app (LSMinimumSystemVersion 14.0).
for f in "$fw"/*.dylib; do
  minos=$(otool -l "$f" | awk '/LC_BUILD_VERSION/ {b=1} b && /minos/ {print $2; exit}')
  if [[ "$(printf '%s\n14.0\n' "$minos" | sort -V | tail -1)" != 14.0 ]]; then
    echo "$(basename "$f") vise macOS $minos (> 14.0)" >&2; bad=1
  fi
done
(( bad == 0 )) || exit 1
echo "Dylibs embarquées : $(ls "$fw"/*.dylib | wc -l | tr -d ' ')"
