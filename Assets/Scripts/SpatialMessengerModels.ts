/**
 * Stable models shared by Telegram transports, the store, and UI.
 * Raw TDLib JSON must be normalized before it reaches the UI.
 */

export type AppPhase =
  | "BOOT"
  | "CONNECTING"
  | "AUTH"
  | "READY"
  | "OFFLINE"
  | "RECONNECTING"
  | "SESSION_ERROR"
  | "LOGGING_OUT"
  | "FATAL_ERROR"

export type AuthorizationState =
  | {kind: "welcome"}
  | {kind: "waitPhoneNumber"}
  | {kind: "waitCode"; expectedLength?: number; delivery: string}
  | {kind: "waitEmailAddress"}
  | {kind: "waitEmailCode"; emailPattern: string; expectedLength?: number}
  | {kind: "waitPassword"; hint: string; recoveryEmailPattern?: string}
  | {kind: "waitOtherDeviceConfirmation"; link: string}
  | {kind: "waitRegistration"}
  | {kind: "connecting"; tdlibType?: string}
  | {kind: "closing"}
  | {kind: "closed"}
  | {kind: "ready"}
  | {kind: "unsupported"; tdlibType: string}

export interface ChatSummary {
  id: string
  title: string
  lastMessage: string
  unreadCount: number
  date?: number
}

export interface ChatInfo {
  id: string
  title: string
  type: string
  phone?: string
  username?: string
  bio?: string
  status?: string
  members?: number
  notificationsMuted?: boolean
}

export interface ChatMessage {
  id: string
  chatId: string
  senderId: string
  outgoing: boolean
  text: string
  date: number
  media?: MessageMedia
}

export type MessageMediaKind = "photo" | "video" | "videoNote" | "voice" | "audio"

export interface MessageMedia {
  kind: MessageMediaKind
  fileId?: number
  thumbnailFileId?: number
  mediaUrl?: string
  thumbnailUrl?: string
  duration?: number
  width?: number
  height?: number
  mimeType?: string
  fileName?: string
  title?: string
  performer?: string
}

export interface AppSnapshot {
  phase: AppPhase
  authorization: AuthorizationState
  connectionLabel: string
  errorMessage: string
  chats: ChatSummary[]
}
