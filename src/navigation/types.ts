import type { ChatType } from "deso-protocol";
import type { RouteProp } from "@react-navigation/native";

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
};

export type RootStackParamList = {
  Main: undefined;
  Composer: undefined;
  Login: undefined;
  Conversation: ConversationRouteParams;
};

export type HomeTabParamList = {
  Messages: undefined;
  Post: undefined;
  Profile: undefined;
};

export type ConversationScreenRouteProp = RouteProp<
  RootStackParamList,
  "Conversation"
>;
