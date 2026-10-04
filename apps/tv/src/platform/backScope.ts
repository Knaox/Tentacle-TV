/**
 * La portée du Retour de la plateforme, résolue par Metro : ce fichier pour
 * Android TV, `backScope.ios.ts` pour l'Apple TV. Le navigateur la pose autour
 * de chaque écran par `redesignWiring/back/BackScope`.
 */
export { AndroidBackScope as PlatformBackScope } from "./androidtv/back/AndroidBackScope";
