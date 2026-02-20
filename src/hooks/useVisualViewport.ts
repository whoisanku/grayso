import { useWindowDimensions } from "react-native";

export function useVisualViewport() {
  const { width, height } = useWindowDimensions();
  return { width, height, offsetTop: 0 };
}
