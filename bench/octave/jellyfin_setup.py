"""Banc Octave — règle le Jellyfin JETABLE (idempotent ; stdlib seule).

    python3 -I jellyfin_setup.py <url> <dossier-d'état> <nombre-de-titres-attendu>

Assistant de Jellyfin, clé d'API, bibliothèque « Musique » (CollectionType
music, /music, aucun fournisseur Internet, surveillance en temps réel), petite
bibliothèque « Films » vide (pour qu'un compte voie AUTRE CHOSE que la musique),
comptes `octave1`, `octave2` (tout) et `octave-sans` (Films seulement).
Écrit `<état>/jellyfin.env` (0600) — jamais imprimé.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

URL, STATE, EXPECTED = sys.argv[1], sys.argv[2], int(sys.argv[3])
ADMIN = ("admin", "octave-banc-admin")
USERS = [("octave1", "octave-banc-1", "all"), ("octave2", "octave-banc-2", "all"),
         ("octave-sans", "octave-banc-0", "films")]
AUTH = 'MediaBrowser Client="octave-banc", Device="octave-banc", DeviceId="octave-banc-{}", Version="1"'


def call(method, path, body=None, token=None, raw=False):
    headers = {"Content-Type": "application/json", "X-Emby-Authorization": AUTH.format("setup")}
    if token:
        headers["X-Emby-Token"] = token
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as res:
        text = res.read().decode()
    if raw:
        return text
    return json.loads(text) if text else None


def wait_up():
    for _ in range(90):
        try:
            if call("GET", "/System/Info/Public").get("Id"):
                return
        except (urllib.error.URLError, ConnectionError, json.JSONDecodeError):
            pass
        time.sleep(2)
    sys.exit("[banc] Jellyfin ne répond pas")


def login(name, password):
    req = urllib.request.Request(URL + "/Users/AuthenticateByName", method="POST",
                                 data=json.dumps({"Username": name, "Pw": password}).encode(),
                                 headers={"Content-Type": "application/json",
                                          "X-Emby-Authorization": AUTH.format(name)})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def wizard():
    if call("GET", "/System/Info/Public").get("StartupWizardCompleted"):
        return
    call("POST", "/Startup/Configuration",
         {"UICulture": "fr", "MetadataCountryCode": "FR", "PreferredMetadataLanguage": "fr"})
    call("GET", "/Startup/User")
    call("POST", "/Startup/User", {"Name": ADMIN[0], "Password": ADMIN[1]})
    call("POST", "/Startup/Complete")


def server_config(key):
    # Le banc veut voir un ajout en secondes : la surveillance attend 60 s par
    # défaut (LibraryMonitorDelay), l'évènement de bibliothèque 30 s (LibraryUpdateDuration).
    cfg = call("GET", "/System/Configuration", token=key)
    if cfg.get("LibraryMonitorDelay") != 5 or cfg.get("LibraryUpdateDuration") != 5:
        cfg["LibraryMonitorDelay"], cfg["LibraryUpdateDuration"] = 5, 5
        call("POST", "/System/Configuration", cfg, token=key)


def api_key(token):
    keys = call("GET", "/Auth/Keys", token=token)["Items"]
    mine = [k for k in keys if k.get("AppName") == "tentacle-octave-banc"]
    if not mine:
        call("POST", "/Auth/Keys?app=tentacle-octave-banc", token=token)
        mine = [k for k in call("GET", "/Auth/Keys", token=token)["Items"] if k.get("AppName") == "tentacle-octave-banc"]
    return mine[0]["AccessToken"]


def library(key, name, ctype, path, types):
    folders = call("GET", "/Library/VirtualFolders", token=key)
    found = [f for f in folders if f["Name"] == name]
    if found:
        return found[0]["ItemId"]
    options = {
        "PathInfos": [{"Path": path}], "EnableInternetProviders": False, "EnableRealtimeMonitor": True,
        "MetadataSavers": [], "SaveLocalMetadata": False, "EnableLUFSScan": True,
        "PreferNonstandardArtistsTag": True,
        "TypeOptions": [{"Type": t, "MetadataFetchers": [], "ImageFetchers": []} for t in types],
    }
    call("POST", f"/Library/VirtualFolders?name={urllib.request.quote(name)}&collectionType={ctype}&refreshLibrary=false",
         {"LibraryOptions": options}, token=key)
    return [f for f in call("GET", "/Library/VirtualFolders", token=key) if f["Name"] == name][0]["ItemId"]


def previous_env():
    try:
        with open(os.path.join(STATE, "jellyfin.env")) as f:
            return dict(line.rstrip("\n").split("=", 1) for line in f if "=" in line)
    except FileNotFoundError:
        return {}


def still_valid(token):
    # Relancer up.sh ne doit pas déconnecter les agents : un jeton qui répond est gardé.
    try:
        return bool(token) and bool(call("GET", "/Users/Me", token=token).get("Id"))
    except urllib.error.HTTPError:
        return False


def user(key, name, password, scope, films_id, previous):
    existing = [u for u in call("GET", "/Users", token=key) if u["Name"] == name]
    uid = existing[0]["Id"] if existing else call("POST", "/Users/New", {"Name": name, "Password": password}, token=key)["Id"]
    policy = call("GET", f"/Users/{uid}", token=key)["Policy"]
    if scope == "films":
        policy["EnableAllFolders"], policy["EnabledFolders"] = False, [films_id]
    else:
        policy["EnableAllFolders"], policy["EnabledFolders"] = True, []
    call("POST", f"/Users/{uid}/Policy", policy, token=key)
    token = previous.get(f"OCTAVE_{name.upper().replace('-', '_')}_TOKEN", "")
    return uid, token if still_valid(token) else login(name, password)["AccessToken"]


def audio_count(key):
    return call("GET", "/Items?Recursive=true&IncludeItemTypes=Audio&Limit=0", token=key)["TotalRecordCount"]


def main():
    wait_up()
    wizard()
    admin = login(*ADMIN)
    key = api_key(admin["AccessToken"])
    server_config(key)
    music = library(key, "Musique", "music", "/music", ["MusicArtist", "MusicAlbum", "Audio"])
    films = library(key, "Films", "movies", "/films", ["Movie"])
    previous = previous_env()
    accounts = {n: user(key, n, p, s, films, previous) for (n, p, s) in USERS}
    if audio_count(key) < EXPECTED:
        call("POST", "/Library/Refresh", token=key)
    for _ in range(90):
        if audio_count(key) >= EXPECTED:
            break
        time.sleep(2)
    count = audio_count(key)
    lines = {
        "OCTAVE_JELLYFIN_URL": URL,
        "OCTAVE_JELLYFIN_INTERNAL_URL": "http://octave-jellyfin:8096",
        "OCTAVE_JELLYFIN_API_KEY": key,
        "OCTAVE_MUSIC_LIBRARY_ID": music,
        "OCTAVE_FILMS_LIBRARY_ID": films,
        "OCTAVE_ADMIN_ID": admin["User"]["Id"],
        "OCTAVE_ADMIN_NAME": ADMIN[0],
        "OCTAVE_ADMIN_PASSWORD": ADMIN[1],
    }
    for name, password, _ in USERS:
        slug = name.upper().replace("-", "_")
        uid, token = accounts[name]
        lines.update({f"OCTAVE_{slug}_ID": uid, f"OCTAVE_{slug}_PASSWORD": password, f"OCTAVE_{slug}_TOKEN": token})
    path = os.path.join(STATE, "jellyfin.env")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.writelines(f"{k}={v}\n" for k, v in lines.items())
    print(f"[banc] Jellyfin prêt : {URL} — {count}/{EXPECTED} titres, bibliothèque Musique {music}")
    if count < EXPECTED:
        sys.exit("[banc] le scan n'a pas tout trouvé")


if __name__ == "__main__":
    main()
