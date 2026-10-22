# Security Policy

## Reporting a vulnerability

**Please do not open a public issue, discussion or pull request for a security
problem.**

Report it privately through GitHub's **Private Vulnerability Reporting**:

1. Go to the [Security tab](https://github.com/Knaox/Tentacle-TV/security) of
   this repository.
2. Click **Report a vulnerability** and fill in the advisory form.

Only the maintainers can see the report, and we can discuss it, fix it and
publish an advisory (with a CVE when relevant) from the same place.

If you cannot use GitHub, you can write to **damienrouge@hotmail.com** with
`[Tentacle TV security]` in the subject.

Please include, as far as you can:

- the affected component (server/backend, web client, desktop app, mobile app,
  Apple TV / Android TV app, LG webOS app, plugin system, Docker image, CI) and
  its version;
- a description of the issue and its impact;
- steps to reproduce, or a proof of concept;
- any known mitigation.

Never include real credentials, Jellyfin API keys or personal data from a
server you do not own.

## Supported versions

Tentacle TV ships as a rolling release: only the **latest published version of
each platform** receives security fixes. The current numbers are listed in
[`versions.json`](versions.json).

| Component | Supported |
| --------- | --------- |
| Server (Docker image `ghcr.io/knaox/tentacle-tv:latest`, Tentacle Server for Windows) | latest `server` version |
| Desktop app (Windows, macOS, Linux) | latest `desktop` version |
| Mobile app (iOS, Android) | latest `mobile` version |
| TV app (Apple TV, Android TV) | latest `tv` version |
| LG webOS app | latest `webos` version |
| Older versions, `:dev` images, pre-releases and test builds | not supported |

Fixes are released as a new version; please update before reporting an issue
that may already be fixed. Clients keep working with servers down to
`minServer` (see `versions.json`), but a security fix on the server is only
shipped on the latest server version.

## Response times

This is a project maintained on personal time. We aim for:

| Step | Target |
| ---- | ------ |
| Acknowledgement of your report | within 3 business days |
| First assessment (confirmed or not, severity) | within 7 days |
| Fix for a critical or high severity issue | as soon as possible, usually within 30 days |
| Fix for a medium or low severity issue | in a following release, usually within 90 days |

We will keep you informed of progress, and credit you in the advisory unless
you prefer to remain anonymous. Please give us a reasonable time to ship a fix
before any public disclosure; we will agree on a disclosure date together.

## Scope

In scope: the code in this repository and the artifacts built from it (Docker
image, desktop, mobile, TV and webOS apps, Tentacle Server for Windows), and the
CI workflows that build and publish them.

Out of scope: vulnerabilities in Jellyfin itself (report them to the
[Jellyfin project](https://github.com/jellyfin/jellyfin/security)), in
third-party plugins published outside this repository, and issues that require
an already compromised server or device.
