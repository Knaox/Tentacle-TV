# Privacy Policy — Tentacle TV

**Last updated: March 9, 2026**

## Overview

Tentacle TV is a media client that connects to your self-hosted Jellyfin server. We are committed to protecting your privacy. This policy explains what data the app handles and how it is used.

## Data Collection

**Tentacle TV does not collect, store, or transmit any personal data to external servers.**

All data stays between your device and your own Jellyfin server:

- **Authentication credentials** (username, access token) are stored locally on your device in the iOS Keychain and used solely to authenticate with your Jellyfin server.
- **Server URL** is stored locally to connect to your chosen Jellyfin server.
- **Playback preferences** (audio/subtitle language) are stored on your Jellyfin server and locally on your device.
- **Watch history and playback progress** are managed entirely by your Jellyfin server.

## Analytics and Tracking

Tentacle TV does **not** use any analytics, tracking, or advertising frameworks. There is no Firebase, Google Analytics, Amplitude, Mixpanel, or any other third-party tracking service.

The app does **not** request access to Apple's App Tracking Transparency (ATT) framework because no tracking occurs.

## Third-Party Services

Tentacle TV connects exclusively to:

- **Your self-hosted Jellyfin server** — the URL you provide during setup. All media data, user accounts, and playback information are managed by your Jellyfin server, which you control.

No data is shared with any third party.

## Permissions

The app requests only the following permissions:

- **Local Network Access** — to discover and connect to Jellyfin servers on your local network.
- **Background Audio** — to continue audio playback when the app is in the background.

The app does **not** request access to your camera, microphone, location, contacts, or photos.

## Account Deletion

You can delete your account directly within the app:

1. Go to **Profile**
2. Scroll to **Danger zone**
3. Tap **Delete my account**

This will permanently delete your Jellyfin user account and all associated data (preferences, watch history, sessions).

## Data Security

- Authentication tokens are stored in the iOS Keychain (encrypted, hardware-backed storage).
- All communications with HTTPS-configured Jellyfin servers are encrypted in transit.

## Children's Privacy

Tentacle TV is not directed at children under the age of 13 and does not knowingly collect personal information from children.

## Contact

For any privacy-related questions, please open an issue on our GitHub repository:
https://github.com/Knaox/Tentacle-TV/issues

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be reflected in this document with an updated revision date.
