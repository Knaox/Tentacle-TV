// Fenêtre du banc GPU : opaque, visible, au premier plan, sans étranglement
// d'arrière-plan. Charge la page construite donnée par BENCH_URL.
import { app, BrowserWindow } from "electron";

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1100,
    height: 600,
    show: true,
    backgroundColor: "#0b0b10",
    webPreferences: { backgroundThrottling: false },
  });
  win.loadURL(process.env.BENCH_URL);
});
app.on("window-all-closed", () => app.quit());
