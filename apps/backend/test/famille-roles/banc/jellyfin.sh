#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# Banc de la Famille (parents, membres mineurs, droits de création) — un
# Jellyfin 10.11 JETABLE (jamais le Jellyfin réel : dev et prod le partagent).
# Conteneur `jf-famille` sur 127.0.0.1:8914.
#
#   jellyfin.sh <dossier-d'état>
#
# Pose : quatre films factices dans « Films » (G, PG-13, R, sans note) ; les
# comptes `proprio` (le futur propriétaire), `coparent` et `ado` (sa politique
# de base : PG-13 au plus, « gore » bloqué, une plage horaire). Écrit dans
# <état>/jf/ : la clé d'API, les jetons et les ids (0600, jamais imprimés).
# Arrêt : docker rm -f jf-famille && docker volume rm jf-famille-{config,cache,media}
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
STATE="$(mkdir -p "$1" && cd "$1" && pwd)"
JF=http://127.0.0.1:8914
umask 077
mkdir -p "$STATE/jf" "$STATE/media/films"

film() { # dossier titre année mpaa
  local d="$STATE/media/$1"; mkdir -p "$d"
  ffmpeg -loglevel error -y -f lavfi -i testsrc=size=320x180:rate=10 -t 3 -c:v libx264 -preset ultrafast "$d/$(basename "$d").mkv"
  printf '<movie><title>%s</title><year>%s</year>%s<lockdata>true</lockdata></movie>\n' "$2" "$3" "$4" > "$d/movie.nfo"
}
film "films/Tout Public (2001)" "Tout Public" 2001 "<mpaa>G</mpaa>"
film "films/Ado Treize (2002)" "Ado Treize" 2002 "<mpaa>PG-13</mpaa>"
film "films/Adulte Rouge (2003)" "Adulte Rouge" 2003 "<mpaa>R</mpaa>"
film "films/Sans Note (2004)" "Sans Note" 2004 ""

docker run -d --name jf-famille -p 127.0.0.1:8914:8096 \
  -v jf-famille-config:/config -v jf-famille-cache:/cache -v jf-famille-media:/media \
  jellyfin/jellyfin:10.11 >/dev/null
docker cp "$STATE/media/films" jf-famille:/media/
for _ in $(seq 1 90); do curl -fsS "$JF/System/Info/Public" 2>/dev/null | grep -q '"Id"' && break; sleep 2; done

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
post "/Library/VirtualFolders?name=Films&collectionType=movies&refreshLibrary=true&api_key=$KEY" \
  -d '{"LibraryOptions":{"PathInfos":[{"Path":"/media/films"}],"EnableInternetProviders":false,"MetadataSavers":[],"TypeOptions":[{"Type":"Movie","MetadataFetchers":[],"ImageFetchers":[]}]}}'
sleep 8

user() { # nom mot-de-passe correctif-python
  local id; id=$(curl -fsS -X POST "$JF/Users/New?api_key=$KEY" -H 'Content-Type: application/json' -d "{\"Name\":\"$1\",\"Password\":\"$2\"}" | json '["Id"]')
  curl -fsS "$JF/Users/$id?api_key=$KEY" | python3 -c "import sys,json;p=json.load(sys.stdin)['Policy'];$3;print(json.dumps(p))" > "$STATE/jf/pol.json"
  post "/Users/$id/Policy?api_key=$KEY" -d @"$STATE/jf/pol.json"; rm -f "$STATE/jf/pol.json"
  echo "$id" > "$STATE/jf/$1-id"; login "$1" "$2" > "$STATE/jf/$1-token"
}
user proprio banc-proprio 'pass'
user coparent banc-coparent 'pass'
user ado banc-ado 'p["MaxParentalRating"]=13;p["BlockedTags"]=["gore"];p["AccessSchedules"]=[{"DayOfWeek":"Everyday","StartHour":0,"EndHour":24}]'
echo "[banc] Jellyfin jetable prêt : $JF (état : $STATE/jf)"
