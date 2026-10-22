# Image security: signature, SBOM, hardening

Every image published to `ghcr.io/knaox/tentacle-tv` (from the release that
ships this page on) is:

- **scanned** before any tag points to it — a fixable CRITICAL or HIGH
  vulnerability stops the release;
- **signed** with [Sigstore cosign](https://docs.sigstore.dev/) in *keyless*
  mode: no key to trust, the signature proves the image was built by the
  `server-image.yml` workflow of the `Knaox/Tentacle-TV` repository, and it is
  recorded in the public Rekor transparency log;
- shipped with its **SBOM** (software bill of materials, SPDX), attached to
  each per-architecture image as a signed attestation.

Images published before that release are not signed.

## Check that an image is genuine

Install [cosign](https://docs.sigstore.dev/cosign/system_config/installation/) (v2.4 or later), then:

```bash
cosign verify ghcr.io/knaox/tentacle-tv:latest \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/Knaox/Tentacle-TV/\.github/workflows/server-image\.yml@refs/(heads/(main|dev)|tags/(server|webos)-v[0-9.]+)$'
```

`Verified OK` and a JSON block mean the image is the one the project built.
Anything else (no signature, another identity): do not run it.

To verify exactly what is running, verify the digest rather than a tag
(tags move):

```bash
docker image inspect --format '{{index .RepoDigests 0}}' ghcr.io/knaox/tentacle-tv:latest
cosign verify ghcr.io/knaox/tentacle-tv@sha256:<digest> \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/Knaox/Tentacle-TV/\.github/workflows/server-image\.yml@refs/(heads/(main|dev)|tags/(server|webos)-v[0-9.]+)$'
```

## Read the SBOM

The SBOM is attested on each per-architecture image (`linux/amd64`,
`linux/arm64`):

```bash
DIGEST=$(docker buildx imagetools inspect ghcr.io/knaox/tentacle-tv:latest --format '{{json .Manifest}}' \
  | jq -r '.manifests[] | select(.platform.architecture=="amd64") | .digest')
cosign verify-attestation --type spdxjson ghcr.io/knaox/tentacle-tv@$DIGEST \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/Knaox/Tentacle-TV/\.github/workflows/server-image\.yml@refs/(heads/(main|dev)|tags/(server|webos)-v[0-9.]+)$' \
  | jq -r '.payload' | base64 -d | jq '.predicate.packages | length'
```

## Optional hardening of the container

The image starts as root only to hand the data folder to `PUID:PGID`
(a volume created by an older image belongs to root), then runs the server as
that user (`su-exec`); nothing else runs as root. Both compose files carry a
commented block that goes further:

- `read_only: true` with a `tmpfs` on `/tmp`: the server only writes to its
  data volume and `/tmp` (yt-dlp cache). **The data volume is mandatory** —
  without it the server cannot start;
- `security_opt: no-new-privileges:true`;
- `cap_drop: [ALL]` plus the four capabilities the start-up needs to hand the
  folder over and drop root (`CHOWN`, `DAC_OVERRIDE`, `SETUID`, `SETGID`).

Or run without root at all: `user: "1000:1000"` (your `PUID:PGID`). The data
folder must then already belong to that user — on a volume created by an image
before 1.25, run the container once without `user:` first.
