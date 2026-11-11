  // --- Démonstration (menu de débogage du front, lot rf2) ----------------------------------
  // Fragment de `update-overlay.js`, glissé par CMake À L'INTÉRIEUR de sa fermeture (jeton
  // __UPDATE_DEMO__, src/update/CMakeLists.txt) : il en lit `snapshot`, `ctx`, `render` et en
  // pose `demo`. Ce n'est pas un script autonome ; sans lui, `demo` reste nul et la surcouche
  // ne change en rien.
  // Le front de développement envoie l'évènement de fenêtre `tentacle:update-demo`
  // ({ snapshot }) : la surcouche montre alors cet instantané FACTICE, à la place du vrai.
  // Rien n'est demandé au natif : ses boutons referment la démonstration, « Redémarrer » joue
  // le voile d'installation trois secondes. `snapshot: null` la referme. Un voile bloquant se
  // referme seul après six secondes — il rend le front inerte, menu de débogage compris.
  // Le vrai instantané reste tenu (`demo.held`) et revient à la fin. Ce nom traverse deux
  // programmes (apps/web/src/dev/debugMenu/debugUpdateDemo.ts) : il ne se renomme pas.
  let heldSeen = false, demoTimer = 0;
  function endDemo() {
    clearTimeout(demoTimer);
    if (!demo) return;
    snapshot = demo.held; demo = null; ctx.rolledBackSeen = heldSeen;
    render();
  }
  function demoAct(action) {
    if (action !== "restart") return endDemo();
    snapshot = Object.assign({}, snapshot, { prompt: "toast", phase: "applying" });
    clearTimeout(demoTimer); demoTimer = setTimeout(endDemo, 3000);
    render();
  }
  window.addEventListener("tentacle:update-demo", (e) => {
    const next = e && e.detail && e.detail.snapshot;
    if (!next || typeof next !== "object") return endDemo();
    if (!demo) { demo = { held: snapshot, act: demoAct }; heldSeen = ctx.rolledBackSeen; }
    ctx.rolledBackSeen = false; snapshot = next;
    clearTimeout(demoTimer);
    if (next.prompt === "blocking" || next.phase === "applying") demoTimer = setTimeout(endDemo, 6000);
    render();
  });
  window.__tentacleUpdateDemo = true;  // le menu de débogage sait que la surcouche écoute
