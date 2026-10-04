module.exports = {
  presets: ["module:@react-native/babel-preset"],
  // Reanimated en DERNIER, comme son plugin l'exige.
  plugins: ["./babel/inlineRedesignFlag", "react-native-reanimated/plugin"],
};
