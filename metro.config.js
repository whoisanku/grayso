const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer"
);

// Filter out 'svg' from assetExts and add font extensions
config.resolver.assetExts = [
  ...config.resolver.assetExts.filter((ext) => ext !== "svg"),
  "woff2",
  "woff",
  "ttf",
  "otf"
];

config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

module.exports = withNativeWind(config, { input: "./global.css" });
