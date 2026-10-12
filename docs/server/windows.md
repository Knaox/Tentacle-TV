# Tentacle Server for Windows

*Version française : [fr/windows.md](fr/windows.md).*

**Tentacle Server** is a Microsoft Store app that runs the Tentacle server on a Windows PC, without Docker. It
is the same server as the Docker image (same code, same setup wizard, same administration), wrapped in an
app that lives in the notification area, starts with your Windows session and is updated by the Store.

It needs **Jellyfin**, the free media server, on the same PC or elsewhere on your network: the setup wizard
finds it, or offers to install it from jellyfin.org with your agreement.

> The app's first version is 1.0.0; after that, its number is the one of the Tentacle server it carries
> (shown in *Administration › Overview*): app 1.28.0 ships server 1.28.0. Lines marked *(to confirm)* describe behaviour that has not been tested on an
> installed package yet.

## Requirements

| | |
|---|---|
| Windows | Windows 10 version 2004 (build 19041) or later, Windows 11 (x64). Windows Server: see [below](#windows-server-and-arm64) |
| Account | any Windows account; no administrator rights are needed for Tentacle itself |
| Network | the PC's network set to **Private** (see [Firewall and network](#firewall-and-network)) |
| Disk | about 150 MB for the app; your media stay where they are |

## Install from the Microsoft Store

Open the Microsoft Store, search for **Tentacle Server**, then **Get** (or **Install**). From a terminal:

```powershell
winget install --source msstore "Tentacle Server"
```

## First launch

1. Open **Tentacle Server** from the Start menu (the Store's **Open** button does the same). A **startup
   screen** appears right away: the logo, the current step (*Starting the server*, *Preparing the database*…)
   and a progress bar. The first start can take a minute. It also asks, once: **"Start Tentacle Server when
   Windows starts?"** — *Yes* or *No*, which you can change later with **Start with Windows** in the icon's
   menu. It closes by itself when the server answers; if the server could not start, it says why, with **Try
   again** and **Open log**. Closed with its cross, the server keeps going: the icon takes over.
2. The Tentacle icon appears in the **notification area**, next to the clock. Windows may hide it under the
   **^** arrow: drag it onto the taskbar to keep it in sight.
3. Your browser opens the setup wizard **once**, on this PC's network address (e.g.
   `http://192.168.1.20:3000`, never `localhost`, so that the addresses saved for your phones and TVs work).
   From this PC no setup code is asked: the first browser on your home network claims the server
   ([setup-security.md](setup-security.md)).
4. Answer the wizard's questions: Jellyfin, your account, your libraries. Afterwards the app starts silently;
   **Open administration** in the icon's menu (or a double-click on the icon) brings you back.

Opening the wizard from another network, or after it was closed? The wizard then asks for the one-time setup
code: **icon › Setup code** shows it (it is also in the log and in `setup-token.txt`).

## The icon's menu

Right-click the Tentacle icon. The first line tells the server's state (*Running, port 3000*, *Port 3000
already in use*…).

| Item | What it does |
|---|---|
| **Open administration** | opens Tentacle in your browser (also a double-click on the icon) |
| **Setup code** | shows the one-time code, as long as setup is not finished |
| **Start with Windows** | ticked: Tentacle starts when you sign in to Windows ([below](#start-with-windows)) |
| **Change port** | lists free ports; Tentacle restarts on the one you pick ([below](#change-the-port)) |
| **Open log** | opens today's log file |
| **Restart server** | shown when the server is stopped or blocked |
| **Delete server data…** | erases Tentacle's data from this PC after a confirmation ([below](#your-data)) |
| **Quit** | stops Tentacle. **Jellyfin keeps running**: it is a separate program |

Launching Tentacle Server again while it runs only opens the administration: there is never a second server.

## Start with Windows

The app registers itself as a startup app; the first-launch screen asks whether you want it. When on, Tentacle
starts **each time you sign in to Windows**, without opening anything (the startup screen then only appears
when it has something to say: setup not finished, question not answered). It does **not** start when the PC is switched on and nobody signs in:
a Store app cannot be a Windows service.

- Turn it off or on with **Start with Windows** in the icon's menu, or in **Settings › Apps › Startup**. If
  you turned it off in Settings, the app cannot turn it back on by itself: do it in Settings.
- **After a Windows update**, Windows restarts and waits at the sign-in screen, so the server stays off. In
  **Settings › Accounts › Sign-in options › Additional settings**, turn on **"Use my sign-in info to
  automatically finish setting up after an update"**: Windows then signs you in after the update, and
  Tentacle starts with your session *(to confirm on an installed package)*.
- **A PC dedicated to the server** (no screen, in a cupboard): set Windows to sign in by itself at startup
  with Microsoft's **Autologon** tool (Sysinternals, learn.microsoft.com/sysinternals/downloads/autologon). It
  stores the password encrypted, not in clear text. Anyone with access to the machine then gets your session:
  keep this for a machine in a safe place, with an account used only for the server.
- **Keep the PC awake**: **Settings › System › Power › Screen and sleep**, *When plugged in, put my device to
  sleep after*: **Never**. A sleeping PC answers no TV.

## Firewall and network

The app declares its own firewall rule when it is installed: inbound connections to **Tentacle Server.exe**
(TCP and UDP, any port) on **Private** and **Domain** networks. No firewall prompt appears, and a port you
change later stays open. **Public** networks stay closed, on purpose: Tentacle never shows itself on a café's
Wi-Fi.

Windows 11 often marks a new network as **Public**. Tentacle then shows a notification, and phones and TVs
cannot reach it. Switch the network to Private: **Settings › Network & internet › Wi-Fi** (or **Ethernet**) ›
your network › **Network profile type › Private network**.

- **Jellyfin's own firewall**: installed in the basic mode, Jellyfin asks once, at its first start, which
  networks to allow: tick **Private**. Installed as a service, it asks nothing and stays closed: allow it in
  **Windows Security › Firewall & network protection › Allow an app through firewall**.
- **Give the PC a fixed address** in your router (DHCP reservation), so your TVs and the router's port
  forwarding keep finding it.
- From the Internet, it works as with Docker: [remote-access.md](remote-access.md).

## Change the port

Tentacle listens on port **3000**. If another program already uses it, the icon says *Port 3000 already in
use* and a notification explains it. **Change port** lists ports that are free right now; pick one and
Tentacle restarts on it.

**TVs and apps already paired must be paired again** (they remember the old address), and a router port
forwarding or reverse proxy must be updated to the new port. Choose the port before pairing your devices.

## Your data

Everything Tentacle keeps — database (`tentacle.db`), settings, accounts' data, extensions, logs — is in:

```
C:\ProgramData\Tentacle Server
```

`ProgramData` is a hidden folder: type `%ProgramData%\Tentacle Server` in File Explorer's address bar. Only
Windows (SYSTEM), the PC's administrators and the account that installed Tentacle can read it: the database
holds keys and tokens. If another Windows account of the PC launches the app, it says that Tentacle is already
installed by another account.

- **Uninstalling keeps your data.** Reinstall the app, and the server comes back as it was, wizard closed.
  The **Reset** button in *Settings › Apps* does not touch them either.
- **To erase them**, use **Delete server data…** in the icon's menu (confirmation required): Tentacle deletes
  the folder, then quits. Then uninstall the app in **Settings › Apps › Installed apps** if you wish. Jellyfin,
  its data and your movies are **never** touched.
- **Back up** by copying `tentacle.db`: **Quit** Tentacle first, copy the file (or the whole folder), then
  start it again from the Start menu.
- **Keep the folder where it is.** A database on OneDrive or a network share can get corrupted; that is why
  Tentacle does not use `Documents`.

## Updates

The Microsoft Store updates the app, server included. But the Store **never updates an app while it runs**,
and Tentacle always runs. So the app checks for an update every day and installs it itself at a quiet moment,
when nobody is watching anything: it stops the server cleanly, saves a copy of the database in
`backups\` (the last three are kept), installs the update, and starts again *(to confirm: delivered with the
package)*. Nothing to do on your side.

*Administration › Overview* says *Updated by the Microsoft Store* instead of giving a Docker command. If your
server is too old for an app, the warning stays: open the Store's **Library** and click **Get updates**.

## Jellyfin

In the wizard's **Jellyfin** step, the app looks for Jellyfin on this PC (the official installer's registry
keys, its configured port, then its answer) and lists every Jellyfin it finds on your network.

- **Jellyfin found**: pick it, as on any installation. If it is installed but stopped: in the basic mode,
  **Start Jellyfin** launches it; as a service, start *Jellyfin Server* in the **Services** app (Tentacle
  never asks for administrator rights).
- **No Jellyfin**: **Install Jellyfin** downloads the **official** installer from `repo.jellyfin.org`
  (the most recent stable version Tentacle has tested), checks its SHA-256 fingerprint and size, then starts
  it **with your agreement**. Windows asks for an administrator's approval: that is Jellyfin's installer, not
  Tentacle. Choose the **basic** install (not the service), which Jellyfin recommends and which sees your
  network drives. The wizard follows the installation in three steps (download, installer open on screen,
  start): when the installer closes, Tentacle **starts Jellyfin** and detects it by itself, then says
  "Jellyfin is installed and running". Installer closed before the end: **Try again** starts it again (and if
  the installation had gone through, Jellyfin is found anyway).
- **If the download, the check or the launch fails** (Smart App Control can block Jellyfin's installer, which
  is not signed), or on an ARM64 PC: the wizard opens **jellyfin.org/downloads/windows**; install Jellyfin
  yourself, the wizard detects it when it answers.

Tentacle never updates, stops or uninstalls Jellyfin: Jellyfin updates itself through its own installer.

## Libraries: D:\Films and network drives

Jellyfin reads your files, so paths are written **as Jellyfin sees them**: `D:\Films`, `E:\Séries`.

- With the wizard opened on this PC, **Browse with File Explorer** opens Windows' folder picker *(to confirm on an
  installed package)*. From another device, the wizard browses Jellyfin's folders instead.
- **Network drives**: a letter like `Z:` exists only in your own session; Jellyfin (above all as a service)
  does not see it. Write the network path instead: `\\NAS\share\Films`. Jellyfin installed in the basic mode
  uses your account and its saved credentials; as a service, it runs as *Network Service*, which needs the
  share to allow the PC's account.
- **USB drives**: give the drive a fixed letter in **Disk Management**, or it may change between two
  connections and the library goes empty.

## Logs

**Open log** in the icon's menu opens today's file:

```
C:\ProgramData\Tentacle Server\logs\server-YYYY-MM-DD.log
```

One file per day, seven days kept. It holds the server's output (the same lines as `docker logs`) and the
app's own lines, marked `[hôte]`. Attach it when you ask for help.

## The `tentacle` command

The app adds a `tentacle` command to Windows (an app
execution alias), for the rare cases the menu does not cover. In PowerShell or Windows Terminal:

```powershell
tentacle setup token      # a new setup code
tentacle setup reset      # reopen the setup wizard
tentacle web status       # web interface on or off (also: on, off, default)
```

The same commands as in the Docker image ([operations.md](operations.md)). If Windows says the command does
not exist: **Settings › Apps › Advanced app settings › App execution aliases**, turn on *tentacle.exe*.

## Windows Server and ARM64

- **Windows Server** has no Microsoft Store. On Windows Server 2025 with the desktop experience,
  `winget install --source msstore "Tentacle Server"` is reported to work, not confirmed by Microsoft *(to
  confirm)*. Nothing is promised for 2019 and 2022, nor for Server Core (no notification area). Since Tentacle
  starts at sign-in, a server needs the automatic sign-in described [above](#start-with-windows).
- **ARM64** (Windows on Snapdragon…): the package is x64 only *(to confirm: running under Windows 11's x64
  emulation is not tested)*. Jellyfin publishes no ARM64 installer, so the wizard always sends you to
  jellyfin.org.

## Limits of the first version

- Starts at sign-in, not at power-on (see above).
- No *audio analysis* for skip detection: it needs ffmpeg, which the app does not carry, so it is not
  offered in this version. Detection by the three Jellyfin plugins works.
- Hardware transcoding is Jellyfin's business: **Jellyfin › Dashboard › Playback › Transcoding** (Intel QSV,
  NVIDIA NVENC, AMD AMF). [gpu.md](gpu.md) is for Docker.

## Troubleshooting

| Symptom | What to do |
|---|---|
| No icon after launch | look under the **^** arrow of the notification area; **Open log** is then in its menu |
| *Port 3000 already in use* | **Change port**, or close the program that holds the port |
| *The server keeps stopping* | **Open log**, read the last lines, then **Restart server** |
| Phones and TVs do not find the server | network set to **Public**? a VPN on the PC? Use the address shown by **Open administration** |
| *Data held by another server* | another Tentacle (or a second account) uses the folder: close it, then **Restart server** |
| Everything else | [troubleshooting.md](troubleshooting.md) |
