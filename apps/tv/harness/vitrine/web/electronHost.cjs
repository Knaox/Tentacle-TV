// L'hôte de capture du client web : Electron, fenêtre HORS ÉCRAN (rien ne
// s'affiche), à la taille et à la densité de l'appareil voulu. Chrome sans
// tête se figeait sur les captures à haute densité (calques d'image en
// opacité partielle, présentation CALayer) ; le rendu hors écran d'Electron
// — le moteur même de l'app de bureau — capture sans jamais se figer.
//
// Piloté de l'extérieur par CDP (`--remote-debugging-port`) ; la capture,
// elle, prend l'image du prochain `paint` hors écran, à la densité DEMANDÉE
// (`capturePage()` la plafonne à celle de l'écran du Mac, 2) :
// GET http://127.0.0.1:<contrôle>/capture.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const http = require("node:http");

const env = (name, fallback) => process.env[name] ?? fallback;
const width = Number(env("VITRINE_WIDTH", 1440));
const height = Number(env("VITRINE_HEIGHT", 900));
const scale = Number(env("VITRINE_SCALE", 2));
const controlPort = Number(env("VITRINE_CONTROL_PORT", 9362));
const profile = env("VITRINE_PROFILE", null);

if (profile) {
  fs.rmSync(profile, { recursive: true, force: true });
  app.setPath("userData", profile);
}
app.commandLine.appendSwitch("remote-debugging-port", env("VITRINE_CDP_PORT", "9361"));
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("force-color-profile", "srgb");
// Une app sans icône dans le Dock : rien ne vient déranger l'écran de l'utilisateur.
app.dock?.hide();

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    webPreferences: { offscreen: { deviceScaleFactor: scale }, backgroundThrottling: false },
  });
  win.webContents.setFrameRate(30);
  win.loadURL("about:blank");
  // Le prochain rendu complet : on invalide toute la vue, puis on attend son `paint`.
  const nextPaint = () =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("aucun rendu en 10 s")), 10_000);
      win.webContents.once("paint", (_event, _dirty, image) => {
        clearTimeout(timer);
        resolve(image);
      });
      win.webContents.invalidate();
    });
  http
    .createServer(async (req, res) => {
      if (req.url !== "/capture") {
        res.writeHead(404).end();
        return;
      }
      try {
        const image = await nextPaint();
        const { width: w, height: h } = image.getSize();
        res.writeHead(200, { "content-type": "image/png", "x-size": `${w}x${h}` });
        res.end(image.toPNG());
      } catch (error) {
        res.writeHead(500, { "content-type": "text/plain" }).end(String(error.message));
      }
    })
    .listen(controlPort, "127.0.0.1");
});

app.on("window-all-closed", () => app.quit());
