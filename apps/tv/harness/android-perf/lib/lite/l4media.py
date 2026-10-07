#!/usr/bin/env python3
# Les fichiers des jeux `lecteur/flux-l4-*` (tâche L4 : coût du son décodé et
# des sous-titres sur une box faible), dans ~/Library/Caches/tentacle-nav-golden/lecteur/l4.
# Une image LÉGÈRE (H.264 640×360, décodée par l'hôte de l'émulateur) et un
# son ou un sous-titre LOURD : bruit rose (le pire cas d'un codec sans perte),
# un ASS de 6 lignes à l'écran en permanence (karaoké, flou, transformations),
# un PGS dense (objet 1400×140, un toutes les 2 s). Usage : python3 l4media.py
import os
import random
import struct
import subprocess

OUT = os.path.expanduser("~/Library/Caches/tentacle-nav-golden/lecteur/l4")
NOISE = "anoisesrc=color=pink:sample_rate=48000:amplitude=0.3:duration=60"


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True, cwd=OUT)


def surround(channels):
    labels = "".join(f"[{c}]" for c in "abcdefgh"[:channels])
    layout = {6: "5.1", 8: "7.1"}[channels]
    return f"[0]asplit={channels}{labels};{labels}amerge=inputs={channels},aformat=channel_layouts={layout}"


def ass_time(t):
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def heavy_ass(seconds):
    lines = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "", "[V4+ Styles]",
             "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
             "Style: Default,Arial,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,4,2,2,40,40,60,1",
             "Style: Sign,Arial,48,&H0000FFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,0,8,40,40,60,1",
             "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    t, n = 0.0, 0
    while t < seconds:
        for k in range(6):
            y = 150 + k * 140
            karaoke = "".join(f"{{\\k20}}syl{j} " for j in range(8))
            style = "Sign" if k % 2 else "Default"
            lines.append(f"Dialogue: {k},{ass_time(t)},{ass_time(t + 3)},{style},,0,0,0,,"
                         f"{{\\blur3\\move(100,{y},1700,{y})\\t(0,3000,\\frscz360\\fscx150\\1c&H00FF00&)}}{karaoke}ligne {n}")
            n += 1
        t += 0.5
    with open(os.path.join(OUT, "heavy.ass"), "w") as f:
        f.write("\n".join(lines) + "\n")


def pgs_segment(t, kind, payload):
    return b"PG" + struct.pack(">IIBH", int(t * 90000), 0, kind, len(payload)) + payload


def heavy_pgs(seconds, width=1400, height=140):
    random.seed(7)

    def rle_line():
        out, x = bytearray(), 0
        while x < width:
            run, color = min(random.randint(3, 24), width - x), random.choice([0, 0, 1, 2])
            if color == 0:
                out += bytes([0, run]) if run < 64 else bytes([0, 0x40 | (run >> 8), run & 0xFF])
            else:
                out += bytes([0, 0x80 | run, color]) if run < 64 else bytes([0, 0xC0 | (run >> 8), run & 0xFF, color])
            x += run
        return bytes(out + b"\x00\x00")

    out, number = bytearray(), 0
    window = struct.pack(">BBHHHH", 1, 0, 260, 880, width, height)
    for i in range(int(seconds // 2)):
        t = i * 2.0
        composition = struct.pack(">HHBHBBBB", 1920, 1080, 0x10, number, 0x80, 0, 0, 1) + struct.pack(">HBBHH", 0, 0, 0, 260, 880)
        palette = struct.pack(">BB", 0, 0) + bytes([0, 16, 128, 128, 0, 1, 235, 128, 128, 255, 2, 16, 128, 128, 255])
        data = struct.pack(">HH", width, height) + b"".join(rle_line() for _ in range(height))
        chunks = [data[k:k + 65000] for k in range(0, len(data), 65000)]
        out += pgs_segment(t, 0x16, composition) + pgs_segment(t, 0x17, window) + pgs_segment(t, 0x14, palette)
        for j, chunk in enumerate(chunks):
            flag = (0x80 if j == 0 else 0) | (0x40 if j == len(chunks) - 1 else 0)
            head = struct.pack(">HBB", 0, 0, flag) + (len(data).to_bytes(3, "big") if j == 0 else b"")
            out += pgs_segment(t, 0x15, head + chunk)
        out += pgs_segment(t, 0x80, b"")
        clear = t + 1.8
        out += pgs_segment(clear, 0x16, struct.pack(">HHBHBBBB", 1920, 1080, 0x10, number + 1, 0x00, 0, 0, 0))
        out += pgs_segment(clear, 0x17, window) + pgs_segment(clear, 0x80, b"")
        number += 2
    with open(os.path.join(OUT, "heavy.sup"), "wb") as f:
        f.write(out)


def main():
    os.makedirs(OUT, exist_ok=True)
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24000/1001:duration=90", "-c:v", "libx264", "-profile:v", "main",
           "-preset", "veryfast", "-b:v", "300k", "-g", "48", "-pix_fmt", "yuv420p", "-an", "video.mkv")
    ffmpeg("-f", "lavfi", "-i", NOISE, "-filter_complex", surround(8) + ":sample_fmts=s32", "-c:a", "truehd", "-strict", "-2", "truehd71.mka")
    ffmpeg("-f", "lavfi", "-i", NOISE, "-filter_complex", surround(6), "-c:a", "dca", "-strict", "-2", "-b:a", "1509k", "dts51.mka")
    ffmpeg("-f", "lavfi", "-i", NOISE, "-filter_complex", surround(6), "-c:a", "eac3", "-b:a", "640k", "eac351.mka")
    ffmpeg("-f", "lavfi", "-i", NOISE, "-filter_complex", surround(6), "-c:a", "ac3", "-b:a", "640k", "ac351.mka")
    ffmpeg("-f", "lavfi", "-i", NOISE, "-ac", "2", "-c:a", "aac", "-b:a", "256k", "aac20.mka")
    for name in ["truehd71", "dts51", "eac351", "ac351", "aac20"]:
        ffmpeg("-stream_loop", "3", "-i", "video.mkv", "-stream_loop", "3", "-i", f"{name}.mka",
               "-map", "0:v", "-map", "1:a", "-c", "copy", "-t", "240", f"l4-{name}.mkv")
    heavy_ass(270)
    heavy_pgs(270)
    # Le WebVTT que Jellyfin sert pour un sous-titre texte (Android TV le charge à côté de la vidéo).
    ffmpeg("-i", "heavy.ass", "heavy.vtt")
    for name, sub in [("ass", "heavy.ass"), ("pgs", "heavy.sup")]:
        ffmpeg("-stream_loop", "2", "-i", "video.mkv", "-stream_loop", "4", "-i", "aac20.mka", "-i", sub,
               "-map", "0:v", "-map", "1:a", "-map", "2", "-c", "copy", "-metadata:s:s:0", "language=fre", "-t", "270", f"l4-{name}.mkv")


if __name__ == "__main__":
    main()
