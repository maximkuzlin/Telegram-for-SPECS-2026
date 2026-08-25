import {AuthorizationState, ChatInfo, ChatMessage, ChatSummary} from "./SpatialMessengerModels"
import {AuthorizationListener, ChatInfoListener, ChatsListener, MessagesListener, ServiceErrorListener, TelegramService, TypingListener} from "./SpatialMessengerTelegramService"

/** Preview-only deterministic Telegram service. It never claims real connectivity. */
export class SpatialMessengerMockTelegramService implements TelegramService {
  private listeners: AuthorizationListener[] = []
  private chatListeners: ChatsListener[] = []
  private messageListeners: MessagesListener[] = []
  private errorListeners: ServiceErrorListener[] = []
  private typingListeners: TypingListener[] = []
  private chatInfoListeners: ChatInfoListener[] = []
  private state: AuthorizationState = {kind: "welcome"}

  constructor(startReady: boolean = false) {
    if (startReady) this.state = {kind: "ready"}
  }

  start(): void {
    this.emit({kind: "waitPhoneNumber"})
  }

  subscribeAuthorization(listener: AuthorizationListener): void {
    this.listeners.push(listener)
    listener(this.state)
  }

  subscribeChats(listener: ChatsListener): void { this.chatListeners.push(listener) }
  subscribeMessages(listener: MessagesListener): void { this.messageListeners.push(listener) }
  subscribeError(listener: ServiceErrorListener): void { this.errorListeners.push(listener) }
  subscribeTyping(listener: TypingListener): void { this.typingListeners.push(listener) }
  subscribeChatInfo(listener: ChatInfoListener): void { this.chatInfoListeners.push(listener) }

  setPhoneNumber(phone: string): void {
    if (phone.trim().length < 6) {
      this.emit({kind: "waitPhoneNumber"})
      return
    }
    this.emit({kind: "waitCode", expectedLength: 5, delivery: "Telegram app"})
  }

  checkCode(code: string): void {
    if (code.trim().length !== 5) {
      this.emit({kind: "waitCode", expectedLength: 5, delivery: "Telegram app"})
      return
    }
    this.emit({kind: "waitEmailAddress"})
  }

  setEmailAddress(email: string): void {
    if (email.indexOf("@") < 1) {
      this.emit({kind: "waitEmailAddress"})
      return
    }
    this.emit({kind: "waitEmailCode", emailPattern: "m***@example.com", expectedLength: 6})
  }

  checkEmailCode(code: string): void {
    if (code.trim().length !== 6) {
      this.emit({kind: "waitEmailCode", emailPattern: "m***@example.com", expectedLength: 6})
      return
    }
    this.emit({kind: "waitPassword", hint: "Your Telegram password hint"})
  }

  checkPassword(password: string): void {
    if (password.length === 0) {
      this.emit({kind: "waitPassword", hint: "Your Telegram password hint"})
      return
    }
    this.emit({kind: "ready"})
  }

  requestChats(): void {
    const chats: ChatSummary[] = [
      {id: "mock-saved", title: "Saved Messages", lastMessage: "Ideas for Spectacles", unreadCount: 0, date: 1},
      {id: "mock-group", title: "Spatial Team", lastMessage: "UI looks compact now", unreadCount: 2, date: 2},
      {id: "mock-alex", title: "Alex", lastMessage: "See you at 18:30", unreadCount: 1, date: 3},
      {id: "mock-design", title: "Design Notes", lastMessage: "New chat layout", unreadCount: 0, date: 4},
      {id: "mock-news", title: "Product News", lastMessage: "Weekly update", unreadCount: 6, date: 5},
    ]
    for (const listener of this.chatListeners) listener(chats)
  }

  requestMessages(chatId: string): void {
    const messages: ChatMessage[] = [
      {id: "1", chatId, senderId: "other", outgoing: false, text: "Hi! The compact chat is ready.", date: 1},
      {id: "2", chatId, senderId: "me", outgoing: true, text: "Great. Testing it on Spectacles.", date: 2},
      {id: "3", chatId, senderId: "other", outgoing: false, text: "Scroll, input and send are active.", date: 3},
    ]
    for (const listener of this.messageListeners) listener(chatId, messages, "replace")
  }

  requestChatInfo(chatId: string): void {
    const info: ChatInfo = {id: chatId, title: "Preview chat", type: "Private chat", phone: "+33 6 12 34 56 78", username: "@preview", bio: "Telegram contact", status: "online"}
    for (const listener of this.chatInfoListeners) listener(info)
  }

  requestOlderMessages(_chatId: string, _beforeMessageId: string): void {}

  sendMessage(chatId: string, text: string): void {
    const message: ChatMessage = {id: String(Date.now()), chatId, senderId: "me", outgoing: true, text, date: Math.floor(Date.now() / 1000)}
    for (const listener of this.messageListeners) listener(chatId, [message], "append")
  }

  sendVoiceMessage(chatId: string, _wavBase64: string, durationSeconds: number): void {
    const seconds = Math.max(1, Math.round(durationSeconds))
    const message: ChatMessage = {
      id: String(Date.now()), chatId, senderId: "me", outgoing: true,
      text: `Voice message • ${seconds}s`, date: Math.floor(Date.now() / 1000),
    }
    for (const listener of this.messageListeners) listener(chatId, [message], "append")
  }

  setTyping(_chatId: string, _typing: boolean): void {}
  markRead(_chatId: string, _messageId: string): void {}

  logout(): void {
    this.emit({kind: "waitPhoneNumber"})
  }

  private emit(state: AuthorizationState): void {
    this.state = state
    for (const listener of this.listeners) listener(state)
  }
}
