module.exports = {
  // Polices Inter (alignées sur le web) — copiées dans
  // android/app/src/main/assets/fonts ; ce manifest permet de re-lier via
  // `npx react-native-asset` si besoin.
  assets: ["./assets/fonts"],
  dependencies: {
    // react-native-webview n'a AUCUN support tvOS (pas de WebView sur Apple
    // TV). On désactive son autolinking CocoaPods, sinon `pod install` casse
    // sur la cible tvOS. Côté JS, `TrailerWebView.ios.tsx` ne l'importe pas.
    "react-native-webview": {
      platforms: { ios: null },
    },
  },
};
