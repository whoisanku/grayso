import { Platform } from "react-native";
import React from "react";

// Check if iOS 26+ for Liquid Glass support
export const isIOS26OrAbove = Platform.OS === "ios" && parseInt(Platform.Version as string, 10) >= 26;

// Conditionally import LiquidGlassView only on iOS 26+
let _LiquidGlassView: React.ComponentType<any> | null = null;

const devLog = (...args: unknown[]) => {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

if (isIOS26OrAbove) {
  try {
    _LiquidGlassView = require("@callstack/liquid-glass").LiquidGlassView;
    devLog(
      "[LiquidGlass] Successfully loaded LiquidGlassView on iOS",
      Platform.Version
    );
  } catch (e) {
    devLog("[LiquidGlass] Failed to load LiquidGlassView:", e);
    _LiquidGlassView = null;
  }
} else {
  devLog(
    "[LiquidGlass] Not iOS 26+, Platform:",
    Platform.OS,
    Platform.Version
  );
}

export const LiquidGlassView = _LiquidGlassView;
