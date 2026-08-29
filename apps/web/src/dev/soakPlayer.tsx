import { useEffect } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { invoke } from "../desktop/bridge";

/**
 * Banc de torture du lecteur desktop — **dev uniquement**.
 *
 * Le gel Windows (film qui continue, UI morte) est trop rare pour être attrapé à la main.
 * S'il a une probabilité `p` par démarrage de lecture, il faut enchaîner des centaines de
 * démarrages plutôt que d'en tenter dix. Ce harness fait exactement ça, avec des délais
 * **aléatoires** : une course entre le thread principal de Tauri et le thread fenêtre de
 * mpv ne se déclenche que si la fenêtre temporelle varie d'un cycle à l'autre.
 *
 * Chaque cycle : navigation vers /watch/:id → lecture → actions aléatoires (pause,
 * plein écran, seek) → retour → délai aléatoire → recommence. Le retour démonte le
 * DesktopPlayer, ce qui déclenche `destroy()` : c'est la fenêtre init/destroy que garde
 * déjà `awaitPendingDestroy`, donc un endroit privilégié pour une course.
 *
 * Depuis la console devtools :
 *     tentacleSoak("<itemId>")            // 200 cycles
 *     tentacleSoak("<itemId>", 1000)      // 1000 cycles
 *     tentacleSoakStop()                  // arrêt propre
 *
 * L'itemId se lit dans l'URL quand tu regardes un film : /watch/<itemId>.
 *
 * Chaque étape est estampillée dans `%LOCALAPPDATA%\Tentacle TV\freeze-probe.log` via
 * `debug_mark`, pour savoir exactement à quel cycle et à quelle étape le gel est survenu.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

let stop = false;

/** Estampille le journal de la sonde. Timeout court : si le thread principal est gelé,
 *  l'invoke ne reviendra jamais et le harness doit continuer à compter malgré tout. */
async function mark(msg: string): Promise<void> {
  try {
    await Promise.race([
      invoke("debug_mark", { msg }),
      sleep(2000).then(() => Promise.reject(new Error("debug_mark-timeout"))),
    ]);
  } catch {
    console.warn(`[soak] debug_mark n'a pas répondu : « ${msg} » — thread principal gelé ?`);
  }
}

/** Actions aléatoires pendant la lecture : ce sont elles qui font varier le timing. */
async function jitterActions(): Promise<void> {
  const actions = ["pause", "fullscreen", "seek", "none"] as const;
  const pick = actions[Math.floor(Math.random() * actions.length)];
  const key = (k: string) =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

  if (pick === "pause") {
    key(" ");
    await sleep(rand(200, 900));
    key(" ");
  } else if (pick === "fullscreen") {
    key("f");
    await sleep(rand(300, 1200));
    key("f");
  } else if (pick === "seek") {
    key("ArrowRight");
    await sleep(rand(100, 400));
    key("ArrowRight");
  }
  await mark(`action=${pick}`);
}

async function run(navigate: NavigateFunction, itemId: string, cycles: number) {
  stop = false;
  await mark(`=== SOAK démarré : ${cycles} cycles sur ${itemId} ===`);
  console.info(`[soak] ${cycles} cycles. tentacleSoakStop() pour arrêter.`);

  for (let i = 1; i <= cycles && !stop; i++) {
    await mark(`--- cycle ${i}/${cycles} : navigation vers /watch ---`);
    navigate(`/watch/${itemId}`);

    // Laisse mpv s'initialiser, créer sa fenêtre enfant et démarrer le flux.
    // La plage est large exprès : on veut parfois couper AVANT playback-restart.
    await sleep(rand(1200, 5000));
    if (stop) break;

    await jitterActions();
    if (stop) break;

    await mark(`cycle ${i} : retour (démontage → mpv destroy)`);
    navigate(-1);

    // Fenêtre init/destroy : c'est ici que la course est la plus probable.
    await sleep(rand(250, 1600));
    if (i % 10 === 0) console.info(`[soak] cycle ${i}/${cycles}`);
  }

  await mark(stop ? "=== SOAK arrêté ===" : "=== SOAK terminé sans gel ===");
  console.info("[soak] fini.");
}

/** Composant vide : enregistre les helpers globaux. Rendu uniquement en dev. */
export function SoakHarness() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.tentacleSoak = (itemId: string, cycles = 200) => {
      if (!itemId) {
        console.error("[soak] usage : tentacleSoak(\"<itemId>\", 200)");
        return;
      }
      void run(navigate, itemId, cycles);
    };
    w.tentacleSoakStop = () => {
      stop = true;
      console.info("[soak] arrêt demandé.");
    };
    return () => {
      delete w.tentacleSoak;
      delete w.tentacleSoakStop;
    };
  }, [navigate]);

  return null;
}
