// Les gestes d'une scène web, par CDP : défiler jusqu'à une section, survoler
// ou maintenir une carte, saisir un code, poser le lecteur sur un instant.
// Une affiche se désigne par son `alt` (les titres des films libres ne se
// traduisent pas) ; un titre de section, par son texte dans la langue de la scène.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Le centre (px CSS) de l'affiche d'une carte, désignée par son titre : `alt`
 *  de l'image (bureau) ou libellé de la carte (miroir, `alt` vide). */
async function cardCenter(page, alt) {
  const box = await page.evaluate(`(() => {
    const title = ${JSON.stringify(alt)};
    const visible = (el) => el.getBoundingClientRect().width > 40;
    let img = [...document.querySelectorAll("img")].find((el) => el.alt === title && visible(el));
    if (!img) {
      const label = [...document.querySelectorAll("p,span,div,h3,h4")].find((el) => el.children.length === 0 && el.textContent.trim() === title);
      for (let node = label; node && !img; node = node.parentElement) img = [...node.querySelectorAll("img")].find(visible);
    }
    if (!img) return null;
    img.scrollIntoView({ block: "center", inline: "nearest" });
    const r = img.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) throw new Error(`aucune carte « ${alt} » à l'écran`);
  return box;
}

/** Fait défiler jusqu'au titre de section `heading` (texte exact), posé à `gap`
 *  px sous l'en-tête fixe de la page (la barre condensée d'une fiche sur le
 *  miroir) : la fin de la section d'avant passe dessous, jamais coupée à vue. */
async function scrollToHeading(page, heading, gap = 20) {
  const script = `(() => {
    const target = [...document.querySelectorAll("h1, h2, h3")]
      .find((h) => h.textContent.trim() === ${JSON.stringify(heading)} && h.getBoundingClientRect().height > 0);
    if (!target) return null;
    const header = Math.max(0, ...[...document.querySelectorAll("body *")].filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") return false;
      const r = el.getBoundingClientRect();
      return r.top <= 1 && r.bottom > 0 && r.height < innerHeight / 3 && r.width > innerWidth / 2
        && cs.visibility !== "hidden" && Number(cs.opacity) > 0.5;
    }).map((el) => el.getBoundingClientRect().bottom));
    const scroller = [...document.querySelectorAll("*")].find((el) => {
      const cs = getComputedStyle(el);
      return (cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 20 && el.contains(target);
    });
    const delta = target.getBoundingClientRect().top - (scroller ? scroller.getBoundingClientRect().top : 0) - header - ${gap};
    if (scroller) scroller.scrollTop += delta;
    else window.scrollBy(0, delta);
    return Math.round(delta);
  })()`;
  // Deux passes : la barre d'une fiche se condense (et s'opacifie) au défilement.
  for (let pass = 0; pass < 2; pass++) {
    if ((await page.evaluate(script)) === null) throw new Error(`aucun titre « ${heading} » à l'écran`);
    await sleep(400);
  }
}

/** Survol d'une carte à la souris (bureau) : le plateau d'actions s'ouvre. */
async function hover(page, alt) {
  const { x, y } = await cardCenter(page, alt);
  await sleep(300);
  for (const step of [0.6, 0.85, 1]) {
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x * step + 4, y: y * step + 4 });
    await sleep(60);
  }
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
}

/** Appui long au doigt (téléphone, tablette) : la feuille d'actions s'ouvre. */
async function longPress(page, alt, holdMs = 900) {
  const { x, y } = await cardCenter(page, alt);
  await sleep(300);
  await page.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await sleep(holdMs);
  await page.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Saisit `text` dans le premier champ de la page, un caractère à la fois. */
async function type(page, text) {
  await page.evaluate(`(document.querySelector("input:not([type=hidden])")?.focus(), true)`);
  for (const char of text) {
    await page.send("Input.insertText", { text: char });
    await sleep(80);
  }
}

/** Pose la vidéo à `seconds`, en pause : la pause réaffiche les commandes et
 *  les garde. Jamais de toucher ici — un toucher est un clic, et le clic du
 *  lecteur RELANCE la lecture (commandes effacées 3 s plus tard). */
async function video(page, seconds) {
  await page.evaluate(`(async () => {
    const v = document.querySelector("video");
    if (!v) throw new Error("pas de vidéo");
    if (v.readyState < 1) await new Promise((r) => v.addEventListener("loadedmetadata", r, { once: true }));
    v.currentTime = ${seconds};
    await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
    v.pause();
    return true;
  })()`);
  await sleep(400);
  const { width, height } = await page.evaluate(`({ width: innerWidth, height: innerHeight })`);
  // Un mouvement de souris réarme l'affichage (le bureau en a besoin, le doigt
  // n'en a pas : l'émulation tactile laisse passer la souris sans la convertir).
  for (const x of [0.5, 0.55, 0.6]) await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: width * x, y: height * 0.55 });
}

/** Joue les gestes d'une scène (`actions` : liste d'objets à une clé). */
export async function play(page, actions = [], { touch, lang }) {
  for (const action of actions) {
    const [kind, arg] = Object.entries(action)[0];
    // `gap` peut dépendre de l'entrée : le miroir (doigt) et le bureau (souris)
    // n'ont pas la même mise en page.
    if (kind === "scrollToHeading") await scrollToHeading(page, arg[lang], typeof arg.gap === "object" ? arg.gap[touch ? "touch" : "mouse"] : arg.gap);
    else if (kind === "hoverOrHold") await (touch ? longPress(page, arg) : hover(page, arg));
    else if (kind === "type") await type(page, arg);
    else if (kind === "video") await video(page, arg);
    else if (kind === "wait") await sleep(arg);
    else throw new Error(`geste inconnu : ${kind}`);
    await sleep(500);
  }
}
