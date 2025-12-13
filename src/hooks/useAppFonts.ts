import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export function useAppFonts() {
  const [fontsLoaded, fontError] = useFonts({
    "Sofia-Pro-Regular": require("@/assets/fonts/SofiaProSoftReg.woff2"),
    "Sofia-Pro-Medium": require("@/assets/fonts/SofiaProSoftMed.woff2"),
    "Sofia-Pro-Bold": require("@/assets/fonts/SofiaProSoftBold.woff2"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide the splash screen after the fonts have loaded (or an error was returned)
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  return { fontsLoaded, fontError };
}
