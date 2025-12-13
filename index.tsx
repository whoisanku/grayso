import "./shims";
import "./font.css";
import "./global.css";
import { registerRootComponent } from "expo";
import { inject } from "@vercel/analytics";
import App from "./src/App";

inject();

registerRootComponent(App);
