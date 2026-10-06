# Hardware transcoding (GPU)

*Version française : [fr/gpu.md](fr/gpu.md).*

Transcoding is done by **Jellyfin**: the GPU is given to the `jellyfin` service of *tentacle-full* (or to your
own Jellyfin). The blocks are already in `compose.yaml`, commented. After changing them:
`docker compose up -d`, then turn it on in **Jellyfin › Dashboard › Playback › Transcoding**.

## Intel (Quick Sync / VA-API) and AMD (VA-API)

```yaml
  jellyfin:
    devices:
      - /dev/dri:/dev/dri
    group_add:
      - "105"            # your "render" group id
```

The `render` group id depends on the distribution:

```bash
getent group render | cut -d: -f3
```

Check on the host that the device exists (`ls -l /dev/dri`) and, if `vainfo` is installed, that it lists the
codecs.

## NVIDIA

Install the NVIDIA Container Toolkit on the host, then:

```yaml
  jellyfin:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
```

## Podman

- Intel/AMD, rootful: the same `devices` and `group_add` lines.
- Intel/AMD, rootless: a numeric `group_add` does not cross the user namespace. Your user must belong to the
  `render` group, and the service gets `userns_mode: keep-id` with `group_add: ["keep-groups"]` (crun runtime)
  instead. This is what the community reports; it is not verified by the project yet, and it does not work
  everywhere.
- NVIDIA: CDI instead of `deploy` — `devices: ["nvidia.com/gpu=all"]` (generate the CDI spec with
  `nvidia-ctk cdi generate`).

A preparation script for a Linux + Podman + GPU check is in `stacks/tests/linux-podman-gpu.sh` (not validated
on real hardware yet).
