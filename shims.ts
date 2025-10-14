import "./get-random-values-shim";

import "@ethersproject/shims";

import { TextDecoder, TextEncoder } from "text-encoding";

import "react-native-url-polyfill/auto";

const g = globalThis as typeof globalThis &
  Partial<{ TextEncoder: typeof TextEncoder; TextDecoder: typeof TextDecoder }>;

if (typeof g.TextEncoder === "undefined") {
  g.TextEncoder = TextEncoder;
}

if (typeof g.TextDecoder === "undefined") {
  g.TextDecoder = TextDecoder;
}
