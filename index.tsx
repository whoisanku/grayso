import "./shims";
import "./global.css";
import { registerRootComponent } from "expo";
import { Platform } from "react-native";
import App from "./src/App";

if (Platform.OS === "web") {
  require("./font.css");
  const { inject } = require("@vercel/analytics");
  inject();
}

registerRootComponent(App);
