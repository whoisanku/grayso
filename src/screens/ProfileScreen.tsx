import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { DeSoIdentityContext } from "react-deso-protocol";
import {
  buildProfilePictureUrl,
  getSingleProfile,
  identity,
  type ProfileEntryResponse,
} from "deso-protocol";

const FALLBACK_BANNER =
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80";
const FALLBACK_AVATAR = "https://images.deso.org/placeholder-profile-pic.png";
const NANOS_IN_DESO = 1_000_000_000;

const formatNumber = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toString();
};

export default function ProfileScreen() {
  const { currentUser, isLoading } = useContext(DeSoIdentityContext);
  const [profileDetails, setProfileDetails] =
    useState<ProfileEntryResponse | null>(
      currentUser?.ProfileEntryResponse ?? null
    );
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const publicKey = currentUser?.PublicKeyBase58Check;

  useEffect(() => {
    setProfileDetails(currentUser?.ProfileEntryResponse ?? null);
  }, [currentUser?.ProfileEntryResponse]);

  useEffect(() => {
    let active = true;

    if (!publicKey) {
      setProfileDetails(null);
      setErrorMessage(null);
      return undefined;
    }

    setIsFetchingProfile(true);
    setErrorMessage(null);

    getSingleProfile({
      PublicKeyBase58Check: publicKey,
      NoErrorOnMissing: true,
    })
      .then((response) => {
        if (!active) {
          return;
        }

        setProfileDetails(response.Profile ?? null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        console.warn("Failed to load profile", error);
        setErrorMessage("Unable to load the latest profile details.");
      })
      .finally(() => {
        if (active) {
          setIsFetchingProfile(false);
        }
      });

    return () => {
      active = false;
    };
  }, [publicKey]);

  const bannerUri = useMemo(() => {
    if (profileDetails?.ExtraData?.CoverImage) {
      return profileDetails.ExtraData.CoverImage;
    }

    return FALLBACK_BANNER;
  }, [profileDetails?.ExtraData?.CoverImage]);

  const avatarUri = useMemo(() => {
    if (!publicKey) {
      return FALLBACK_AVATAR;
    }

    try {
      return buildProfilePictureUrl(publicKey, {
        fallbackImageUrl: FALLBACK_AVATAR,
      });
    } catch (error) {
      console.warn("Failed to build profile picture URL", error);
      return FALLBACK_AVATAR;
    }
  }, [publicKey]);

  const username = profileDetails?.Username ?? "Unnamed";
  const description = profileDetails?.Description?.trim();
  const coinHolders = profileDetails?.CoinEntry?.NumberOfHolders ?? 0;
  const coinPrice = profileDetails?.CoinPriceDeSoNanos
    ? profileDetails.CoinPriceDeSoNanos / NANOS_IN_DESO
    : 0;
  const desoBalance = currentUser?.BalanceNanos
    ? currentUser.BalanceNanos / NANOS_IN_DESO
    : 0;
  const hodlersCount = currentUser?.UsersWhoHODLYouCount ?? 0;

  const handleLogout = useCallback(async () => {
    try {
      console.log("Logging out...");
      await identity.logout();
      console.log("Logout successful");
    } catch (logoutError) {
      console.warn("Logout error:", logoutError);
    }
  }, []);

  if (!currentUser && !isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <Text className="text-center text-base text-slate-700">
          Sign in with your DeSo identity to view your profile.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <Image
        source={{ uri: bannerUri }}
        className="h-[120px] w-full"
        resizeMode="cover"
      />
      <View className="-mt-10 flex-row items-start justify-between px-4">
        <View className="h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-white">
          <Image source={{ uri: avatarUri }} className="h-full w-full" />
        </View>
        <TouchableOpacity
          className="mt-12 rounded-full bg-black px-4 py-2 opacity-30"
          disabled
        >
          <Text className="font-bold text-white">Follow</Text>
        </TouchableOpacity>
      </View>
      <View className="p-4">
        <Text className="text-2xl font-bold text-slate-900">{username}</Text>
        <Text className="text-base text-gray-500" numberOfLines={1}>
          {publicKey}
        </Text>
        {!!description && (
          <Text className="mt-3 text-base leading-6 text-slate-700">
            {description}
          </Text>
        )}
        {errorMessage ? (
          <Text className="mt-3 text-sm text-rose-500">{errorMessage}</Text>
        ) : null}
        <View className="mt-4 flex-row flex-wrap">
          <View className="mr-6 mb-3">
            <Text className="text-lg font-bold text-slate-900">
              {formatNumber(coinHolders)}
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Coin holders
            </Text>
          </View>
          <View className="mr-6 mb-3">
            <Text className="text-lg font-bold text-slate-900">
              {coinPrice.toFixed(2)}
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Creator coin (DESO)
            </Text>
          </View>
          <View className="mr-6 mb-3">
            <Text className="text-lg font-bold text-slate-900">
              {desoBalance.toFixed(2)}
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Balance (DESO)
            </Text>
          </View>
          <View className="mr-6 mb-3">
            <Text className="text-lg font-bold text-slate-900">
              {formatNumber(hodlersCount)}
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              People holding you
            </Text>
          </View>
        </View>
      </View>
      <View className="px-4 pb-8">
        <TouchableOpacity
          className="items-center rounded-xl bg-rose-500 py-3"
          onPress={handleLogout}
        >
          <Text className="text-lg font-semibold text-white">Logout</Text>
        </TouchableOpacity>
      </View>
      {(isLoading || isFetchingProfile) && (
        <View className="absolute inset-0 items-center justify-center bg-white/60">
          <ActivityIndicator size="large" color="#000" />
        </View>
      )}
    </ScrollView>
  );
}
