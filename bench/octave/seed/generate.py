"""Banc Octave — génère la bibliothèque témoin dans <dossier> (idempotent).

    python generate.py <dossier-musique> [--late]

Son synthétique (ffmpeg aevalsrc), ReplayGain MESURÉ (EBU R128, référence
−18 LUFS, celle de ReplayGain 2), tags par `tags.py`, DSF par `dsf.py`.
`--late` n'écrit que le titre « arrivée tardive » (preuve des événements).
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catalog import ALBUMS, LATE_TRACK  # noqa: E402
from dsf import write_dsf  # noqa: E402
from tags import write_tags  # noqa: E402

EXT = {"flac16": "flac", "flac24": "flac", "alac": "m4a", "aac": "m4a", "opus": "opus",
       "wav": "wav", "mp3vbr": "mp3", "mp3cbr": "mp3", "dsf": "dsf"}
ENCODE = {
    "flac16": ["-c:a", "flac", "-sample_fmt", "s16"],
    "flac24": ["-c:a", "flac", "-sample_fmt", "s32", "-bits_per_raw_sample", "24"],
    "alac": ["-c:a", "alac", "-sample_fmt", "s16p", "-movflags", "+faststart"],
    "aac": ["-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart"],
    "opus": ["-c:a", "libopus", "-b:a", "160k"],
    "wav": ["-c:a", "pcm_s16le"],
    "mp3vbr": ["-c:a", "libmp3lame", "-q:a", "0"],
    "mp3cbr": ["-c:a", "libmp3lame", "-b:a", "320k"],
}


def ff(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def rate_of(fmt):
    return {"flac24": 96000, "opus": 48000}.get(fmt, 44100)


def melody(base, index, amp):
    # Arpège de piano : notes de 1/3 s, attaque brève, décroissance exponentielle.
    step = f"floor(mod(t*3\\,8))*{2 + index % 3}/12"
    env = "(1-exp(-80*mod(t\\,1/3)))*exp(-3*mod(t\\,1/3))"
    return (f"{amp}*sin(2*PI*{base}*pow(2\\,{step}+{index}/12)*t)*{env}"
            f"+{amp / 3}*sin(2*PI*{base / 2}*t)")


def synth(path, expr, seconds, rate):
    ff("-f", "lavfi", "-i", f"aevalsrc={expr}|{expr}:s={rate}:d={seconds}", "-c:a", "pcm_f32le", path)


def loudness(path):
    """Intégrée (LUFS) et crête vraie (linéaire), par le scanner EBU R128 de ffmpeg."""
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true",
                           "-f", "null", "-"], capture_output=True, text=True, check=True)
    integrated = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", proc.stderr)[-1])
    peak_db = float(re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", proc.stderr)[-1])
    return integrated, 10 ** (peak_db / 20)


def make_cover(path, colors, seed):
    if not os.path.exists(path):
        ff("-f", "lavfi", "-i", f"gradients=s=600x600:c0={colors[0]}:c1={colors[1]}:seed={seed}:speed=0",
           "-frames:v", "1", "-q:v", "3", path)


def render_sources(album, tmp):
    """Les WAV flottants de chaque titre, à la fréquence du format visé."""
    paths = []
    tracks = album["tracks"]
    if album.get("gapless"):
        # Un seul balayage continu, coupé à l'échantillon près.
        rate, seconds = 44100, sum(t["seconds"] for t in tracks)
        whole = os.path.join(tmp, "whole.wav")
        expr = "0.3*sin(2*PI*(220*t+3*t*t))+0.1*sin(2*PI*110*t)"
        synth(whole, expr, seconds, rate)
        start = 0
        for i, t in enumerate(tracks):
            end = start + t["seconds"] * rate + (137 if i < len(tracks) - 1 else 0)
            out = os.path.join(tmp, f"t{i}.wav")
            ff("-i", whole, "-af", f"atrim=start_sample={start}:end_sample={end},asetpts=N/SR/TB",
               "-c:a", "pcm_f32le", out)
            paths.append(out)
            start = end
        return paths
    for i, t in enumerate(tracks):
        out = os.path.join(tmp, f"t{i}.wav")
        amp = 0.12 + 0.07 * (i % 4)  # des volumes différents : des ReplayGain différents
        synth(out, melody(album["base"], i, amp), t["seconds"], rate_of(t["fmt"]))
        paths.append(out)
    return paths


def album_loudness(paths, tmp):
    """Gain d'album : la mesure sur les titres mis bout à bout (fréquence commune)."""
    listing = os.path.join(tmp, "list.txt")
    resampled = []
    for i, p in enumerate(paths):
        r = os.path.join(tmp, f"r{i}.wav")
        ff("-i", p, "-ar", "48000", "-c:a", "pcm_f32le", r)
        resampled.append(r)
    with open(listing, "w") as f:
        f.writelines(f"file '{p}'\n" for p in resampled)
    joined = os.path.join(tmp, "album.wav")
    ff("-f", "concat", "-safe", "0", "-i", listing, "-c", "copy", joined)
    return loudness(joined)


def build_album(root, album, seed):
    folder = os.path.join(root, album["dir"])
    os.makedirs(folder, exist_ok=True)
    artist_dir = os.path.dirname(folder)
    make_cover(os.path.join(artist_dir, "folder.jpg"), album["color"][::-1], seed + 100)
    cover_path = os.path.join(folder, "cover.jpg")
    make_cover(cover_path, album["color"], seed)
    with open(cover_path, "rb") as f:
        cover = f.read()
    tracks = album["tracks"]
    names = [f"{i + 1:02d} - {t['title']}.{EXT[t['fmt']]}" for i, t in enumerate(tracks)]
    if all(os.path.exists(os.path.join(folder, n)) for n in names):
        return []
    tmp = tempfile.mkdtemp(prefix="octave-seed-")
    try:
        sources = render_sources(album, tmp)
        album_i, album_peak = album_loudness(sources, tmp)
        written = []
        for i, (t, src, name) in enumerate(zip(tracks, sources, names)):
            dest = os.path.join(folder, name)
            if t["fmt"] == "dsf":
                write_dsf(dest, 3.0)
                rg = None  # un DSD sans ReplayGain : le cas réel le plus courant
            else:
                ff("-i", src, "-ar", str(rate_of(t["fmt"])), "-map_metadata", "-1", *ENCODE[t["fmt"]], dest)
                ti, tp = loudness(src)
                rg = {"trackGain": -18 - ti, "trackPeak": tp, "albumGain": -18 - album_i, "albumPeak": album_peak}
            write_tags(dest, t["fmt"], album, t, i + 1, len(tracks), rg, cover)
            written.append({"path": dest, "recording": t["recording"], "rg": rg})
        return written
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    root = sys.argv[1]
    late = "--late" in sys.argv
    albums = [LATE_TRACK] if late else ALBUMS
    report = []
    for seed, album in enumerate(albums, start=1):
        report += build_album(root, album, seed + (50 if late else 0))
    print(json.dumps({"written": len(report), "files": [os.path.relpath(r["path"], root) for r in report]},
                     ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
