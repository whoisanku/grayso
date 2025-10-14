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
  StyleSheet,
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
    if (!currentUser) {
      console.warn("Logout error: No user is currently logged in.");
      return;
    }
    try {
      await identity.logout();
    } catch (logoutError) {
      console.warn("Logout error:", logoutError);
    }
  }, [currentUser]);

  if (!currentUser && !isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyStateText}>
          Sign in with your DeSo identity to view your profile.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: bannerUri }} style={styles.banner} />
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        </View>
        <TouchableOpacity style={styles.followButton} disabled>
          <Text style={styles.followButtonText}>Follow</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.profileInfo}>
        <Text style={styles.displayName}>{username}</Text>
        <Text style={styles.handle} numberOfLines={1}>
          {publicKey}
        </Text>
        {!!description && <Text style={styles.description}>{description}</Text>}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
        <View style={styles.stats}>
          <View style={styles.statBlock}>
            <Text style={styles.statCount}>{formatNumber(coinHolders)}</Text>
            <Text style={styles.statLabel}>Coin holders</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statCount}>{coinPrice.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Creator coin (DESO)</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statCount}>{desoBalance.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Balance (DESO)</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statCount}>{formatNumber(hodlersCount)}</Text>
            <Text style={styles.statLabel}>People holding you</Text>
          </View>
        </View>
      </View>
      <View style={styles.logoutContainer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
      {(isLoading || isFetchingProfile) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  banner: {
    width: "100%",
    height: 120,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    marginTop: -40,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    overflow: "hidden",
    backgroundColor: "white",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  followButton: {
    backgroundColor: "#000",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 48,
  },
  followButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  profileInfo: {
    padding: 16,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "bold",
  },
  handle: {
    fontSize: 16,
    color: "gray",
  },
  description: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 16,
  },
  statCount: {
    fontWeight: "bold",
    fontSize: 18,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  statBlock: {
    marginRight: 24,
    marginBottom: 12,
  },
  errorText: {
    marginTop: 12,
    color: "#d9534f",
  },
  logoutContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  logoutButton: {
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  emptyStateText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
});
