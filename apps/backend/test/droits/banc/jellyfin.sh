#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# Banc des droits — un Jellyfin 10.11 JETABLE (jamais le Jellyfin réel : dev
# et prod le partagent). Conteneur `droits-filtrage-jf` sur 127.0.0.1:18121.
#
#   jellyfin.sh <dossier-d'état>
#
# Pose : cinq films factices (G, PG-13, R, sans note, G étiqueté « interdit »)
# dans « Films », un film G dans « Docs » ; les comptes `enfant` (note maximale
# PG, non classés bloqués, étiquette « interdit » bloquée) et `filmsseuls`
# (bibliothèque « Films » seule). Écrit dans <état>/jf/ : la clé d'API, les
# jetons et les ids (fichiers 0600, jamais imprimés).
# Arrêt : docker rm -f droits-filtrage-jf && docker volume rm droits-filtrage-jf-{config,cache,media}
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
STATE="$(mkdir -p "$1" && cd "$1" && pwd)"
JF=http://127.0.0.1:18121
umask 077
mkdir -p "$STATE/jf" "$STATE/media/films" "$STATE/media/docs"

film() { # dossier titre année mpaa tag
  local d="$STATE/media/$1"; mkdir -p "$d"
  ffmpeg -loglevel error -y -f lavfi -i testsrc=size=320x180:rate=10 -t 3 -c:v libx264 -preset ultrafast "$d/$(basename "$d").mkv"
  printf '<movie><title>%s</title><year>%s</year>%s%s<lockdata>true</lockdata></movie>\n' "$2" "$3" "$4" "$5" > "$d/movie.nfo"
}
film "films/Tout Public (2001)" "Tout Public" 2001 "<mpaa>G</mpaa>" ""
film "films/Ado Treize (2002)" "Ado Treize" 2002 "<mpaa>PG-13</mpaa>" ""
film "films/Adulte Rouge (2003)" "Adulte Rouge" 2003 "<mpaa>R</mpaa>" ""
film "films/Sans Note (2004)" "Sans Note" 2004 "" ""
film "films/Etiquete Bloque (2005)" "Etiquete Bloque" 2005 "<mpaa>G</mpaa>" "<tag>interdit</tag>"
film "docs/Doc Prive (2006)" "Doc Prive" 2006 "<mpaa>G</mpaa>" ""

docker run -d --name droits-filtrage-jf -p 127.0.0.1:18121:8096 \
  -v droits-filtrage-jf-config:/config -v droits-filtrage-jf-cache:/cache -v droits-filtrage-jf-media:/media \
  jellyfin/jellyfin:10.11 >/dev/null
docker cp "$STATE/media/films" droits-filtrage-jf:/media/
docker cp "$STATE/media/docs" droits-filtrage-jf:/media/
for _ in $(seq 1 60); do curl -fsS "$JF/System/Info/Public" 2>/dev/null | grep -q '"Id"' && break; sleep 2; done

json() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }
post() { curl -fsS -o /dev/null -X POST "$JF$1" -H 'Content-Type: application/json' "${@:2}"; }
post /Startup/Configuration -d '{"UICulture":"fr","MetadataCountryCode":"US","PreferredMetadataLanguage":"fr"}'
curl -fsS -o /dev/null "$JF/Startup/User"
post /Startup/User -d '{"Name":"admin","Password":"banc-admin"}'
post /Startup/Complete
login() { curl -fsS -X POST "$JF/Users/AuthenticateByName" -H 'Content-Type: application/json' \
  -H "X-Emby-Authorization: MediaBrowser Client=\"banc\", Device=\"banc\", DeviceId=\"banc-$1\", Version=\"1\"" \
  -d "{\"Username\":\"$1\",\"Pw\":\"$2\"}" | json '["AccessToken"]'; }
ADMIN=$(login admin banc-admin); echo "$ADMIN" > "$STATE/jf/admin-token"
curl -fsS -o /dev/null -X POST "$JF/Auth/Keys?app=tentacle-banc" -H "X-Emby-Token: $ADMIN"
KEY=$(curl -fsS "$JF/Auth/Keys" -H "X-Emby-Token: $ADMIN" | json '["Items"][0]["AccessToken"]'); echo "$KEY" > "$STATE/jf/api-key"
lib() { post "/Library/VirtualFolders?name=$1&collectionType=movies&refreshLibrary=true&api_key=$KEY" \
  -d "{\"LibraryOptions\":{\"PathInfos\":[{\"Path\":\"/media/$2\"}],\"EnableInternetProviders\":false,\"MetadataSavers\":[],\"TypeOptions\":[{\"Type\":\"Movie\",\"MetadataFetchers\":[],\"ImageFetchers\":[]}]}}"; }
lib Films films; lib Docs docs; sleep 8
FILMS=$(curl -fsS "$JF/Library/MediaFolders?api_key=$KEY" | python3 -c 'import sys,json;print([i["Id"] for i in json.load(sys.stdin)["Items"] if i["Name"]=="Films"][0])')

user() { # nom mot-de-passe correctif-python
  local id; id=$(curl -fsS -X POST "$JF/Users/New?api_key=$KEY" -H 'Content-Type: application/json' -d "{\"Name\":\"$1\",\"Password\":\"$2\"}" | json '["Id"]')
  curl -fsS "$JF/Users/$id?api_key=$KEY" | python3 -c "import sys,json;p=json.load(sys.stdin)['Policy'];$3;print(json.dumps(p))" > "$STATE/jf/pol.json"
  post "/Users/$id/Policy?api_key=$KEY" -d @"$STATE/jf/pol.json"; rm -f "$STATE/jf/pol.json"
  echo "$id" > "$STATE/jf/$1-id"; login "$1" "$2" > "$STATE/jf/$1-token"
}
user enfant banc-enfant 'p["MaxParentalRating"]=10;p["BlockUnratedItems"]=["Movie"];p["BlockedTags"]=["interdit"]'
user filmsseuls banc-films "p['EnableAllFolders']=False;p['EnabledFolders']=['$FILMS']"
echo "[banc] Jellyfin jetable prêt : $JF (état : $STATE/jf)"
