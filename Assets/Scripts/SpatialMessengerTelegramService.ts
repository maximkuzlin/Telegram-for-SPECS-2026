import {AuthorizationState, ChatInfo, ChatMessage, ChatSummary} from "./SpatialMessengerModels"

export type AuthorizationListener = (state: AuthorizationState) => void
export type ChatsListener = (chats: ChatSummary[]) => void
export type MessageBatchMode = "replace" | "append" | "prepend"
export type MessagesListener = (chatId: string, messages: ChatMessage[], mode: MessageBatchMode) => void
export type ServiceErrorListener = (message: string) => void
export type TypingListener = (chatId: string, action: string) => void
export type ChatInfoListener = (info: ChatInfo) => void
export type TypingRequest = {chatId: string; typing: boolean}
export type ReadRequest = {chatId: string; messageId: string}

/** Transport boundary. UI and store never depend on raw TDLib payloads. */
export interface TelegramService {
  start(): void
  subscribeAuthorization(listener: AuthorizationListener): void
  subscribeChats(listener: ChatsListener): void
  subscribeMessages(listener: MessagesListener): void
  subscribeError(listener: ServiceErrorListener): void
  subscribeTyping(listener: TypingListener): void
  subscribeChatInfo(listener: ChatInfoListener): void
  setPhoneNumber(phone: string): void
  checkCode(code: string): void
  setEmailAddress(email: string): void
  checkEmailCode(code: string): void
  checkPassword(password: string): void
  requestChats(): void
  requestMessages(chatId: string): void
  requestChatInfo(chatId: string): void
  requestOlderMessages(chatId: string, beforeMessageId: string): void
  sendMessage(chatId: string, text: string): void
  sendVoiceMessage(chatId: string, wavBase64: string, durationSeconds: number): void
  setTyping(chatId: string, typing: boolean): void
  markRead(chatId: string, messageId: string): void
  logout(): void
}
