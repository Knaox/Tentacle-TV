# Transcodage matériel (GPU)

*English version: [../gpu.md](../gpu.md).*

Le transcodage est fait par **Jellyfin** : le GPU se donne au service `jellyfin` de *tentacle-full* (ou à votre
propre Jellyfin). Les blocs sont déjà dans `compose.yaml`, en commentaire. Après les avoir changés :
`docker compose up -d`, puis activez-le dans **Jellyfin › Tableau de bord › Lecture › Transcodage**.

## Intel (Quick Sync / VA-API) et AMD (VA-API)

```yaml
  jellyfin:
    devices:
      - /dev/dri:/dev/dri
    group_add:
      - "105"            # l'identifiant de votre groupe « render »
```

L'identifiant du groupe `render` dépend de la distribution :

```bash
getent group render | cut -d: -f3
```

Vérifiez sur l'hôte que le périphérique existe (`ls -l /dev/dri`) et, si `vainfo` est installé, qu'il liste les
codecs.

## NVIDIA

Installez le NVIDIA Container Toolkit sur l'hôte, puis :

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

- Intel/AMD, avec root : les mêmes lignes `devices` et `group_add`.
- Intel/AMD, sans root : un `group_add` numérique ne traverse pas l'espace de noms utilisateur. Votre compte
  doit faire partie du groupe `render`, et le service reçoit à la place `userns_mode: keep-id` et
  `group_add: ["keep-groups"]` (runtime crun). C'est ce que rapporte la communauté ; le projet ne l'a pas
  encore vérifié, et cela ne fonctionne pas partout.
- NVIDIA : CDI au lieu de `deploy` — `devices: ["nvidia.com/gpu=all"]` (générez la spécification CDI avec
  `nvidia-ctk cdi generate`).

Un script de préparation pour une vérification Linux + Podman + GPU se trouve dans
`stacks/tests/linux-podman-gpu.sh` (pas encore validé sur un vrai matériel).
