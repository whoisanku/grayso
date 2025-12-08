import type { ChatType } from "deso-protocol";
import type { RouteProp, NavigatorScreenParams } from "@react-navigation/native";

export type ConversationRouteParams = {
  threadPublicKey: string;
  chatType: ChatType;
  userPublicKey: string;
  threadAccessGroupKeyName?: string;
  userAccessGroupKeyName?: string;
  partyGroupOwnerPublicKeyBase58Check?: string;
  lastTimestampNanos?: number;
  lastTimestampNanosString?: string;
  title?: string;
  recipientInfo?: any;
  initialGroupMembers?: any[];
  initialMessage?: string;
};

export type HomeTabParamList = {
  Messages: undefined;
  Post: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<HomeTabParamList> | undefined;
  Composer: undefined;
  Login: undefined;
  Conversation: ConversationRouteParams;
  Settings: undefined;
  NewChat: undefined;
};

export type ConversationScreenRouteProp = RouteProp<
  RootStackParamList,
  "Conversation"
>;

