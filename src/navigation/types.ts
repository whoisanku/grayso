import type { ChatType } from "deso-protocol";
import type {
  RouteProp,
  NavigatorScreenParams,
} from "@react-navigation/native";

import type { FocusFeedPost } from "@/lib/focus/graphql";

export type ConversationRouteParams = {
  threadPublicKey: string;
  chatType?: ChatType;
  userPublicKey?: string;
  threadAccessGroupKeyName?: string;
  userAccessGroupKeyName?: string;
  partyGroupOwnerPublicKeyBase58Check?: string;
  lastTimestampNanos?: number;
  lastTimestampNanosString?: string;
  title?: string;
  recipientInfo?: any;
  initialGroupMembers?: any[];
  initialMessage?: string;
  initialProfile?: any; // Profile data to avoid loading delay
};

export type HomeTabParamList = {
  Messages: undefined;
  Feed: undefined;
  Search: undefined;
  Wallet: undefined;
  Notifications: undefined;
  Post: undefined;
  Profile:
    | {
        username?: string;
        publicKey?: string;
      }
    | undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<HomeTabParamList> | undefined;
  Composer: undefined;
  Login: undefined;
  Conversation: ConversationRouteParams;
  Settings: undefined;
  NewChat: undefined;
  PostThread: {
    postHash: string;
    initialPost?: FocusFeedPost | null;
    initialIsFollowingAuthor?: boolean | null;
  };
};

export type ConversationScreenRouteProp = RouteProp<
  RootStackParamList,
  "Conversation"
>;
