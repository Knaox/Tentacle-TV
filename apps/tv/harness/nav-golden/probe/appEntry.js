/* eslint-disable */
// Ce que le point d'entrée de l'app (`apps/tv/index.js`) reçoit À LA PLACE de
// `./src/App` quand Metro sert le banc (`lib/metroConfig.cjs`) : la sonde
// d'abord, puis l'App réelle, inchangée. Rien de l'app ne bouge : seul le
// paquet du banc contient ce module.
require("./navProbe");
module.exports = require("nav-golden-real-app");
