import type { NewMessageEntryResponse } from "deso-protocol";

export type MessageThreadRouteParams = {
  thread: NewMessageEntryResponse;
  displayName: string;
  avatarUri?: string | null;
  counterpartPublicKey: string;
  isGroupChat: boolean;
  userAccessGroupKeyName?: string | null;
  counterpartAccessGroupKeyName?: string | null;
  groupAccessGroupKeyName?: string | null;
};

export type RootStackParamList = {
  Main: undefined;
  Composer: undefined;
  MessageThread: MessageThreadRouteParams;
  Login: undefined;
};

export type HomeTabParamList = {
  Messages: undefined;
  Post: undefined;
  Profile: undefined;
};
