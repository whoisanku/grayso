import { useState } from "react";
import { View, Text, ViewStyle, ImageStyle } from "react-native";
import { Image } from "expo-image";
import { useColorScheme } from "nativewind";
import UserGroupIcon from "@/assets/navIcons/user-group.svg";

const DEFAULT_AVATAR_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

type UserAvatarProps = {
  uri?: string | null;
  name?: string;
  size?: number;
  isGroup?: boolean;
  className?: string;
  style?: ImageStyle;
  cachePolicy?: "none" | "disk" | "memory" | "memory-disk";
  recyclingKey?: string;
};

export function UserAvatar({
  uri,
  name = "?",
  size = 56, // Default h-14 equivalent (14 * 4 = 56)
  isGroup = false,
  className,
  style,
  cachePolicy = "memory-disk",
  recyclingKey,
}: UserAvatarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [hasError, setHasError] = useState(false);

  // If we have a URI and haven't encountered an error, show the image
  if (uri && !hasError) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        className={`rounded-full ${className || ""}`}
        placeholder={{ blurhash: DEFAULT_AVATAR_BLURHASH }}
        placeholderContentFit="cover"
        transition={200}
        contentFit="cover"
        onError={() => setHasError(true)}
        cachePolicy={cachePolicy}
        recyclingKey={recyclingKey}
      />
    );
  }

  // Fallback UI
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        style,
        { backgroundColor: isGroup ? (isDark ? "#1e293b" : "#f1f5f9") : (isDark ? "#1e293b" : "#e2e8f0") }
      ]}
      className={`items-center justify-center rounded-full ${className || ""}`}
    >
      {isGroup ? (
        <UserGroupIcon
          width={size * 0.45}
          height={size * 0.45}
          stroke={isDark ? "#94a3b8" : "#64748b"}
          strokeWidth={2}
        />
      ) : (
        <Text
          style={{ 
            color: isDark ? "#ffffff" : "#0f172a",
            fontSize: size * 0.4,
            fontWeight: "bold"
          }}
        >
          {(name || "?").charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}
