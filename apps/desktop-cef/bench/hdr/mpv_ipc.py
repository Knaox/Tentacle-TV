#!/usr/bin/env python3
"""Lit des propriétés d'un mpv lancé avec --input-ipc-server (preuves vidéo-HDR).

Usage : mpv_ipc.py <socket> <propriété> [<propriété> …]
Écrit une ligne JSON par propriété : {"prop": …, "value": …} (ou "error").
"""
import json
import socket
import sys
import time


def query(sock_path, props):
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    for _ in range(50):
        try:
            s.connect(sock_path)
            break
        except OSError:
            time.sleep(0.1)
    else:
        raise SystemExit(f"socket {sock_path} injoignable")
    f = s.makefile("rwb")
    for i, prop in enumerate(props):
        f.write(json.dumps({"command": ["get_property", prop], "request_id": i}).encode() + b"\n")
    f.flush()
    pending = {i: p for i, p in enumerate(props)}
    while pending:
        msg = json.loads(f.readline())
        rid = msg.get("request_id")
        if rid in pending:
            out = {"prop": pending.pop(rid)}
            out.update({"value": msg["data"]} if msg.get("error") == "success" else {"error": msg.get("error")})
            print(json.dumps(out, ensure_ascii=False))
    s.close()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    query(sys.argv[1], sys.argv[2:])
