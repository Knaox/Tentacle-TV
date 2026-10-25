"""Banc Octave — un fichier DSF (DSD64) écrit à la main : ffmpeg sait le LIRE,
pas l'écrire. Modulation delta-sigma d'ordre 2 d'un accord simple, stéréo.

Format (Sony, « DSF File Format Specification » 1.01) : blocs « DSD  », « fmt  »,
« data », bits LSB d'abord, 4096 octets par canal et par bloc, entrelacés.
"""

import math
import struct

RATE = 2_822_400
BLOCK = 4096


def _modulate(seconds: float, freqs, amp: float) -> bytes:
    n = int(RATE * seconds)
    n_bytes = n // 8
    out = bytearray(n_bytes)
    i1 = i2 = 0.0
    y = 0.0
    steps = [2 * math.pi * f / RATE for f in freqs]
    phases = [0.0] * len(freqs)
    k = 0
    for b in range(n_bytes):
        byte = 0
        for bit in range(8):
            x = 0.0
            for j, step in enumerate(steps):
                phases[j] += step
                x += math.sin(phases[j])
            x *= amp / len(steps)
            i1 += x - y
            i2 += i1 - y
            y = 1.0 if i2 >= 0 else -1.0
            if y > 0:
                byte |= 1 << bit
            k += 1
        out[b] = byte
    return bytes(out)


def write_dsf(path: str, seconds: float = 4.0) -> None:
    left = _modulate(seconds, (220.0, 277.18, 329.63), 0.5)
    right = left
    per_channel = len(left)
    blocks = (per_channel + BLOCK - 1) // BLOCK
    pad = blocks * BLOCK - per_channel
    left += b"\x69" * pad  # motif de silence DSD (0x69) pour finir le dernier bloc
    right += b"\x69" * pad
    data = bytearray()
    for i in range(blocks):
        data += left[i * BLOCK:(i + 1) * BLOCK]
        data += right[i * BLOCK:(i + 1) * BLOCK]
    sample_count = per_channel * 8
    fmt = b"fmt " + struct.pack("<QIIIIIIQII", 52, 1, 0, 2, 2, RATE, 1, sample_count, BLOCK, 0)
    data_chunk = b"data" + struct.pack("<Q", 12 + len(data)) + bytes(data)
    total = 28 + len(fmt) + len(data_chunk)
    head = b"DSD " + struct.pack("<QQQ", 28, total, 0)
    with open(path, "wb") as f:
        f.write(head + fmt + data_chunk)
