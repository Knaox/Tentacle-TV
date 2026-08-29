/**
 * Audit des animations en cours — **développement uniquement**.
 *
 * Pourquoi cet outil existe : le compteur d'images (`FrameMeter`) disait bien
 * « 120 i/s », mais jamais POURQUOI le compositeur tournait. Or c'est là que se
 * jouait l'essentiel de la consommation au repos.
 *
 * Le mécanisme à connaître : une animation en cours force le navigateur à
 * produire une image à CHAQUE rafraîchissement de l'écran, qu'elle dessine
 * quelque chose ou non. Le compositeur ne se rendort pas, le GPU ne redescend
 * pas en veille. Il suffit d'UNE animation infinie oubliée — fût-elle posée sur
 * un élément invisible ou de taille nulle — pour tenir toute l'application
 * éveillée. C'est exactement ce qui se passait ici : une quarantaine de
 * squelettes de chargement brillaient dans le vide, plus une pastille
 * d'onboarding, sur une page où rien ne bougeait.
 *
 * Usage, dans la console du navigateur :
 *
 *     __animations()        // tableau lisible, trié par gravité
 *     __animations(true)    // idem, mais renvoie aussi les objets Animation
 *
 * Ce qu'il faut lire : sur une page au repos, images chargées, la colonne
 * « infinie » doit être VIDE. Toute entrée qui y figure est une consommation
 * permanente, et le « visible: non » signale celles qui ne rendent même pas le
 * service pour lequel on les paie.
 */

interface AnimationReport {
  name: string;
  infinite: boolean;
  visible: boolean;
  size: string;
  durationMs: number | string;
  element: string;
}

function describe(target: Element): string {
  const cls = target.className?.toString?.() ?? "";
  return cls ? `${target.tagName.toLowerCase()}.${cls.trim().split(/\s+/).slice(0, 3).join(".")}` : target.tagName.toLowerCase();
}

function audit(withHandles = false) {
  const rows: AnimationReport[] = [];
  const handles: Animation[] = [];

  for (const animation of document.getAnimations()) {
    const target = animation.effect && "target" in animation.effect
      ? (animation.effect as KeyframeEffect).target
      : null;
    if (!target) continue;

    const timing = animation.effect!.getTiming();
    const rect = target.getBoundingClientRect();
    const onScreen =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      rect.right > 0 &&
      rect.left < window.innerWidth;

    rows.push({
      // `animationName` n'existe que sur les animations CSS ; les transitions et
      // les animations de Framer n'en ont pas.
      name: (animation as CSSAnimation).animationName || animation.constructor.name,
      infinite: timing.iterations === Infinity,
      visible: onScreen,
      size: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
      durationMs: typeof timing.duration === "number" ? timing.duration : String(timing.duration),
      element: describe(target),
    });
    if (withHandles) handles.push(animation);
  }

  // Le pire d'abord : infinie ET invisible, c'est-à-dire payée pour rien.
  rows.sort((a, b) => Number(b.infinite) - Number(a.infinite) || Number(a.visible) - Number(b.visible));

  const infinites = rows.filter((r) => r.infinite);
  console.info(
    `%c${rows.length} animation(s) en cours — ${infinites.length} infinie(s), ` +
      `dont ${infinites.filter((r) => !r.visible).length} sur un élément invisible`,
    infinites.length ? "color:#ff9d5c;font-weight:bold" : "color:#7CFFB2;font-weight:bold",
  );
  console.table(rows);

  return withHandles ? handles : rows;
}

/**
 * Branché sur `window` en développement seulement. Le montage passe par
 * `import.meta.env.DEV`, que Vite remplace littéralement par `false` au build :
 * le module entier disparaît alors du bundle livré, comme `FrameMeter`.
 */
export function installAnimationAudit(): void {
  if (!import.meta.env.DEV) return;
  (window as unknown as { __animations: typeof audit }).__animations = audit;
}
