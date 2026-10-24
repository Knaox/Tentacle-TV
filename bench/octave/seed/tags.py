"""Banc Octave — les tags (mutagen) : MusicBrainz complets, ReplayGain, pochette.

Mêmes clés que Picard, par famille de conteneur :
- Vorbis (FLAC, Opus) : MUSICBRAINZ_TRACKID = l'ENREGISTREMENT (convention Picard) ;
- MP4 (ALAC, AAC) : atomes libres « ----:com.apple.iTunes:MusicBrainz … » ;
- ID3 (MP3, WAV, DSF) : UFID « http://musicbrainz.org » = l'enregistrement, TXXX pour le reste.
"""

from mutagen.flac import FLAC, Picture
from mutagen.oggopus import OggOpus
from mutagen.mp4 import MP4, MP4Cover, MP4FreeForm
from mutagen.id3 import ID3, APIC, TALB, TCON, TDRC, TIT2, TPE1, TPE2, TPOS, TRCK, TXXX, UFID, TPUB
from mutagen.wave import WAVE
from mutagen.dsf import DSF


def _common(album, track, index, total, rg):
    artists = track["artists"]
    tags = {
        "TITLE": track["title"],
        "ARTIST": " & ".join(a["name"] for a in artists),
        "ARTISTS": [a["name"] for a in artists],
        "ALBUM": album["title"],
        "ALBUMARTIST": album["artist"]["name"],
        "TRACKNUMBER": str(index),
        "TRACKTOTAL": str(total),
        "DISCNUMBER": "1",
        "DATE": album["date"],
        "GENRE": album["genre"],
        "LABEL": "Banc Octave",
        "RELEASETYPE": album["type"],
        "MUSICBRAINZ_TRACKID": track["recording"],
        "MUSICBRAINZ_ALBUMID": album["release"],
        "MUSICBRAINZ_RELEASEGROUPID": album["releaseGroup"],
        "MUSICBRAINZ_ARTISTID": [a["mbid"] for a in artists],
        "MUSICBRAINZ_ALBUMARTISTID": album["artist"]["mbid"],
    }
    if rg is not None:
        tags.update({
            "REPLAYGAIN_TRACK_GAIN": f"{rg['trackGain']:+.2f} dB",
            "REPLAYGAIN_TRACK_PEAK": f"{rg['trackPeak']:.6f}",
            "REPLAYGAIN_ALBUM_GAIN": f"{rg['albumGain']:+.2f} dB",
            "REPLAYGAIN_ALBUM_PEAK": f"{rg['albumPeak']:.6f}",
        })
    return tags


def _vorbis(f, tags, cover):
    for key, value in tags.items():
        f[key] = value if isinstance(value, list) else [value]


def _flac(path, tags, cover):
    f = FLAC(path)
    _vorbis(f, tags, cover)
    pic = Picture()
    pic.type, pic.mime, pic.data = 3, "image/jpeg", cover
    f.add_picture(pic)
    f.save()


def _opus(path, tags, cover):
    f = OggOpus(path)
    _vorbis(f, tags, cover)
    f.save()


MP4_FREE = {
    "MUSICBRAINZ_TRACKID": "MusicBrainz Track Id",
    "MUSICBRAINZ_ALBUMID": "MusicBrainz Album Id",
    "MUSICBRAINZ_RELEASEGROUPID": "MusicBrainz Release Group Id",
    "MUSICBRAINZ_ARTISTID": "MusicBrainz Artist Id",
    "MUSICBRAINZ_ALBUMARTISTID": "MusicBrainz Album Artist Id",
    "RELEASETYPE": "MusicBrainz Album Type",
    "ARTISTS": "ARTISTS",
    "LABEL": "LABEL",
    "REPLAYGAIN_TRACK_GAIN": "replaygain_track_gain",
    "REPLAYGAIN_TRACK_PEAK": "replaygain_track_peak",
    "REPLAYGAIN_ALBUM_GAIN": "replaygain_album_gain",
    "REPLAYGAIN_ALBUM_PEAK": "replaygain_album_peak",
}


def _mp4(path, tags, cover):
    f = MP4(path)
    f["\xa9nam"], f["\xa9ART"], f["aART"] = tags["TITLE"], tags["ARTIST"], tags["ALBUMARTIST"]
    f["\xa9alb"], f["\xa9day"], f["\xa9gen"] = tags["ALBUM"], tags["DATE"], tags["GENRE"]
    f["trkn"] = [(int(tags["TRACKNUMBER"]), int(tags["TRACKTOTAL"]))]
    f["disk"] = [(1, 1)]
    f["covr"] = [MP4Cover(cover, imageformat=MP4Cover.FORMAT_JPEG)]
    for key, name in MP4_FREE.items():
        if key not in tags:
            continue
        values = tags[key] if isinstance(tags[key], list) else [tags[key]]
        f[f"----:com.apple.iTunes:{name}"] = [MP4FreeForm(v.encode("utf-8")) for v in values]
    f.save()


ID3_TXXX = {
    "MUSICBRAINZ_ALBUMID": "MusicBrainz Album Id",
    "MUSICBRAINZ_RELEASEGROUPID": "MusicBrainz Release Group Id",
    "MUSICBRAINZ_ARTISTID": "MusicBrainz Artist Id",
    "MUSICBRAINZ_ALBUMARTISTID": "MusicBrainz Album Artist Id",
    "RELEASETYPE": "MusicBrainz Album Type",
    "ARTISTS": "ARTISTS",
    "REPLAYGAIN_TRACK_GAIN": "REPLAYGAIN_TRACK_GAIN",
    "REPLAYGAIN_TRACK_PEAK": "REPLAYGAIN_TRACK_PEAK",
    "REPLAYGAIN_ALBUM_GAIN": "REPLAYGAIN_ALBUM_GAIN",
    "REPLAYGAIN_ALBUM_PEAK": "REPLAYGAIN_ALBUM_PEAK",
}


def _fill_id3(t, tags, cover):
    t.add(TIT2(encoding=3, text=tags["TITLE"]))
    t.add(TPE1(encoding=3, text=tags["ARTISTS"]))
    t.add(TPE2(encoding=3, text=tags["ALBUMARTIST"]))
    t.add(TALB(encoding=3, text=tags["ALBUM"]))
    t.add(TRCK(encoding=3, text=f"{tags['TRACKNUMBER']}/{tags['TRACKTOTAL']}"))
    t.add(TPOS(encoding=3, text="1/1"))
    t.add(TDRC(encoding=3, text=tags["DATE"]))
    t.add(TCON(encoding=3, text=tags["GENRE"]))
    t.add(TPUB(encoding=3, text=tags["LABEL"]))
    t.add(UFID(owner="http://musicbrainz.org", data=tags["MUSICBRAINZ_TRACKID"].encode("ascii")))
    for key, desc in ID3_TXXX.items():
        if key in tags:
            values = tags[key] if isinstance(tags[key], list) else [tags[key]]
            t.add(TXXX(encoding=3, desc=desc, text=values))
    t.add(APIC(encoding=3, mime="image/jpeg", type=3, desc="Cover", data=cover))


def _mp3(path, tags, cover):
    t = ID3()
    _fill_id3(t, tags, cover)
    t.save(path, v2_version=4)


def _container_id3(cls):
    def write(path, tags, cover):
        f = cls(path)
        if f.tags is None:
            f.add_tags()
        _fill_id3(f.tags, tags, cover)
        f.save()
    return write


WRITERS = {
    "flac16": _flac, "flac24": _flac, "opus": _opus, "alac": _mp4, "aac": _mp4,
    "mp3vbr": _mp3, "mp3cbr": _mp3, "wav": _container_id3(WAVE), "dsf": _container_id3(DSF),
}


def write_tags(path, fmt, album, track, index, total, rg, cover):
    WRITERS[fmt](path, _common(album, track, index, total, rg), cover)
