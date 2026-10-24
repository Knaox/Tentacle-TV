"""Banc Octave — le catalogue des fichiers témoins (aucun contenu protégé).

Le son est SYNTHÉTIQUE (ffmpeg, aevalsrc) ; seuls les tags disent une œuvre.
Deux familles de MBID :
- RÉELS : Kevin MacLeod (CC BY 4.0, incompetech) — artiste, releases et
  enregistrements relevés sur musicbrainz.org le 2026-10-24. Le son n'est PAS
  le sien : les durées sont raccourcies, seul l'appariement compte.
- DE TEST : préfixe `0c7a0e00-…` (« octave »), forme d'UUID v4 valide, absents de
  MusicBrainz. Documentés dans le README du banc.
"""

KM = {"name": "Kevin MacLeod", "mbid": "8292bf44-2dd1-4bad-8019-276ec38f28e7"}
BANC = {"name": "Banc Octave", "mbid": "0c7a0e00-0000-4000-8000-0000000000a1"}
ENSEMBLE = {"name": "Ensemble Témoin", "mbid": "0c7a0e00-0000-4000-8000-0000000000a2"}


def test_id(kind: str, n: int) -> str:
    """UUID de test : 0c7a0e00-0000-4000-8<kind>-<n sur 12 chiffres>."""
    return f"0c7a0e00-0000-4000-8{kind:0>3}-{n:012d}"


def _tracks(rows, fmt, seconds=20):
    return [
        {"title": t, "recording": rec, "artists": artists, "fmt": fmt if f is None else f, "seconds": seconds}
        for (t, rec, artists, f) in rows
    ]


ALBUMS = [
    {
        "dir": "Kevin MacLeod/Bright Piano Works (2007)",
        "title": "Bright Piano Works",
        "artist": KM,
        "year": 2007,
        "date": "2007",
        "type": "ep",
        "release": "cb1bd62b-02d7-4f97-882c-3a9f69010a8d",
        "releaseGroup": "ed6b2aad-bc02-40d3-bf33-0e0b4f04da3a",
        "genre": "Classical",
        "color": ("0x7c3aed", "0xec4899"),
        "base": 261.63,
        "tracks": _tracks([
            ("Bright Wish", "b0d63be6-0394-4064-8848-ca928cc987ff", [KM], None),
            ("Heartwarming", "279c1cda-5126-470b-87b7-95a4524ad9e3", [KM], None),
            ("Luminous Rain", "12edbd82-3bdc-4b30-ab6d-0978a1221476", [KM], None),
            ("Midday Dance", "63af2d93-bf8b-4028-9ffa-56b486a7c5e5", [KM], None),
        ], "flac16"),
    },
    {
        "dir": "Kevin MacLeod/Elegant Piano (2006)",
        "title": "Elegant Piano",
        "artist": KM,
        "year": 2006,
        "date": "2006",
        "type": "album",
        "release": "27928422-e5bb-42a6-ac71-03180f7b0bb3",
        "releaseGroup": "0214ffb5-bfb6-4f85-86c6-9a24dfcd3b0a",
        "genre": "Classical",
        "color": ("0x0ea5e9", "0x312e81"),
        "base": 220.0,
        "tracks": _tracks([
            ("Atlantean Twilight", "2308b57c-a740-4750-b632-219cf70c5f1b", [KM], None),
            ("Awaiting Return", "0d9a4887-2397-45d0-b53a-b71909683a55", [KM], None),
            ("Continue Life", "e737aa71-5d58-4356-9150-241e14c95e68", [KM], None),
            ("Moonstone", "edc4dffd-6bd9-41db-890b-251cb7911aa0", [KM], None),
        ], "flac24"),
    },
    {
        "dir": "Kevin MacLeod/Polka! Polka! Polka! (2006)",
        "title": "Polka! Polka! Polka!",
        "artist": KM,
        "year": 2006,
        "date": "2006",
        "type": "album",
        "release": "73ac40ca-44fa-4785-ab90-9586bc982c2d",
        "releaseGroup": "b84c783c-040c-48cf-88bd-cec24992ca82",
        "genre": "Polka",
        "color": ("0xf59e0b", "0xdc2626"),
        "base": 293.66,
        "tracks": _tracks([
            ("Double Polka", "864122fc-9682-452f-b231-8a8ae834a184", [KM], None),
            ("Dvorak Polka", "1d0b3ec0-2428-48c1-bcbd-87a0e9be218c", [KM], None),
            ("Four Beers’ Polka", "50f6cb6e-6cb8-4fdc-a016-cb78581cf096", [KM], "mp3cbr"),
            ("Glee Club Polka", "92c75f50-8081-4180-9d5f-3b526e920c25", [KM], "mp3cbr"),
        ], "mp3vbr"),
    },
    {
        # L'album à enchaînement CONTINU : un seul balayage coupé en cinq, au
        # milieu d'une onde (jamais au passage à zéro) — tout blanc s'entend.
        "dir": "Banc Octave/Enchaînement continu (2026)",
        "title": "Enchaînement continu",
        "artist": BANC,
        "year": 2026,
        "date": "2026-10-24",
        "type": "album",
        "release": test_id("b", 1),
        "releaseGroup": test_id("c", 1),
        "genre": "Electronic",
        "color": ("0x10b981", "0x064e3b"),
        "gapless": True,
        "tracks": _tracks([
            (f"Mouvement {i}", test_id("d", 100 + i), [BANC], None) for i in range(1, 6)
        ], "flac16", seconds=12),
    },
    {
        "dir": "Banc Octave/Formats témoins (2026)",
        "title": "Formats témoins",
        "artist": BANC,
        "year": 2026,
        "date": "2026-10-24",
        "type": "compilation",
        "release": test_id("b", 2),
        "releaseGroup": test_id("c", 2),
        "genre": "Test",
        "color": ("0x64748b", "0x0f172a"),
        "base": 196.0,
        "tracks": _tracks([
            ("Témoin ALAC", test_id("d", 201), [BANC], "alac"),
            ("Témoin AAC", test_id("d", 202), [BANC], "aac"),
            ("Témoin Opus", test_id("d", 203), [BANC], "opus"),
            ("Témoin WAV", test_id("d", 204), [BANC], "wav"),
            ("Témoin DSD", test_id("d", 205), [BANC], "dsf"),
            ("Témoin MP3", test_id("d", 206), [BANC], "mp3cbr"),
        ], "flac16", seconds=15),
    },
    {
        "dir": "Ensemble Témoin/Duos d'été (2025)",
        "title": "Duos d'été",
        "artist": ENSEMBLE,
        "year": 2025,
        "date": "2025-06-21",
        "type": "album",
        "release": test_id("b", 3),
        "releaseGroup": test_id("c", 3),
        "genre": "Pop",
        "color": ("0xfde047", "0xf472b6"),
        "base": 329.63,
        "tracks": _tracks([
            ("Été à Noël", test_id("d", 301), [ENSEMBLE], None),
            ("Ça déménage", test_id("d", 302), [ENSEMBLE, BANC], None),
            ("Œuvre crépusculaire", test_id("d", 303), [ENSEMBLE], None),
        ], "opus"),
    },
]

# Le titre ajouté APRÈS coup par `add-track.sh` (preuve des événements).
LATE_TRACK = {
    "dir": "Ensemble Témoin/Arrivée tardive (2026)",
    "title": "Arrivée tardive",
    "artist": ENSEMBLE,
    "year": 2026,
    "date": "2026-10-24",
    "type": "single",
    "release": test_id("b", 9),
    "releaseGroup": test_id("c", 9),
    "genre": "Pop",
    "color": ("0xa855f7", "0x1e1b4b"),
    "base": 246.94,
    "tracks": _tracks([("Nouvelle venue", test_id("d", 901), [ENSEMBLE], None)], "flac16", seconds=10),
}
