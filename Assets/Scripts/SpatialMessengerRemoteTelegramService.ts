import {AuthorizationState, ChatInfo, ChatMessage, ChatSummary} from "./SpatialMessengerModels"
import {AuthorizationListener, ChatInfoListener, ChatsListener, MessagesListener, ServiceErrorListener, TelegramService, TypingListener} from "./SpatialMessengerTelegramService"

/** HTTPS/WSS client for Assets/Backend. API credentials never enter this Lens. */
export class SpatialMessengerRemoteTelegramService implements TelegramService {
  private internet: InternetModule = require("LensStudio:InternetModule")
  private socket: WebSocket | null = null
  private authListeners: AuthorizationListener[] = []
  private chatListeners: ChatsListener[] = []
  private messageListeners: MessagesListener[] = []
  private errorListeners: ServiceErrorListener[] = []
  private typingListeners: TypingListener[] = []
  private chatInfoListeners: ChatInfoListener[] = []
  private activeChatId: string = ""
  private historyLoading: boolean = false
  private reconnectEvent: DelayedCallbackEvent
  private reconnectAttempt: number = 0
  private reconnectScheduled: boolean = false
  private started: boolean = false

  constructor(private owner: BaseScriptComponent, private baseUrl: string, private token: string = "") {
    this.reconnectEvent = this.owner.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.reconnectEvent.bind(() => {
      this.reconnectScheduled = false
      this.connectSocket()
      this.refreshAfterReconnect()
    })
  }

  start(): void {
    this.started = true
    try {
      this.connectSocket()
    } catch (error) {
      this.emitError(error)
    }
    this.getJson("/v1/auth/state").then((state) => this.emitAuth(state as AuthorizationState)).catch((e) => this.emitError(e))
  }

  subscribeAuthorization(listener: AuthorizationListener): void { this.authListeners.push(listener) }
  subscribeChats(listener: ChatsListener): void { this.chatListeners.push(listener) }
  subscribeMessages(listener: MessagesListener): void { this.messageListeners.push(listener) }
  subscribeError(listener: ServiceErrorListener): void { this.errorListeners.push(listener) }
  subscribeTyping(listener: TypingListener): void { this.typingListeners.push(listener) }
  subscribeChatInfo(listener: ChatInfoListener): void { this.chatInfoListeners.push(listener) }

  setPhoneNumber(value: string): void { this.postValue("/v1/auth/phone", value) }
  checkCode(value: string): void { this.postValue("/v1/auth/code", value) }
  setEmailAddress(value: string): void { this.postValue("/v1/auth/email", value) }
  checkEmailCode(value: string): void { this.postValue("/v1/auth/email-code", value) }
  checkPassword(value: string): void { this.postValue("/v1/auth/password", value) }

  requestChats(): void {
    this.getJson("/v1/chats?limit=30").then((data) => {
      const chats = ((data as {chats?: ChatSummary[]}).chats || [])
      for (const listener of this.chatListeners) listener(chats)
    }).catch((e) => this.emitError(e))
  }

  requestMessages(chatId: string): void {
    this.activeChatId = chatId
    this.getJson(`/v1/chats/${chatId}/messages?limit=20`).then((data) => {
      const messages = this.withMediaUrls((data as {messages?: ChatMessage[]}).messages || [])
      for (const listener of this.messageListeners) listener(chatId, messages, "replace")
    }).catch((e) => this.emitError(e))
  }

  requestChatInfo(chatId: string): void {
    this.getJson(`/v1/chats/${chatId}/info`).then((data) => {
      for (const listener of this.chatInfoListeners) listener(data as ChatInfo)
    }).catch((e) => this.emitError(e))
  }

  requestOlderMessages(chatId: string, beforeMessageId: string): void {
    if (this.historyLoading || !beforeMessageId) return
    this.historyLoading = true
    this.getJson(`/v1/chats/${chatId}/messages?limit=20&before=${beforeMessageId}`).then((data) => {
      const messages = this.withMediaUrls((data as {messages?: ChatMessage[]}).messages || [])
      for (const listener of this.messageListeners) listener(chatId, messages, "prepend")
    }).catch((e) => this.emitError(e)).finally(() => { this.historyLoading = false })
  }

  sendMessage(chatId: string, text: string): void {
    this.postJson(`/v1/chats/${chatId}/messages`, {text}).then((data) => {
      const message = (data as {message?: ChatMessage}).message
      if (message) for (const listener of this.messageListeners) listener(chatId, this.withMediaUrls([message]), "append")
    }).catch((e) => this.emitError(e))
  }

  sendVoiceMessage(chatId: string, wavBase64: string, durationSeconds: number): void {
    this.postJson(`/v1/chats/${chatId}/voice`, {wavBase64, durationSeconds}).then((data) => {
      const message = (data as {message?: ChatMessage}).message
      if (message) for (const listener of this.messageListeners) listener(chatId, this.withMediaUrls([message]), "append")
    }).catch((e) => this.emitError(e))
  }

  setTyping(chatId: string, typing: boolean): void {
    this.postJson(`/v1/chats/${chatId}/action`, {typing}).catch((e) => this.emitError(e))
  }

  markRead(chatId: string, messageId: string): void {
    this.postJson(`/v1/chats/${chatId}/read`, {messageId}).catch((e) => this.emitError(e))
  }

  logout(): void { this.postJson("/v1/auth/logout", {}).catch((e) => this.emitError(e)) }

  private postValue(path: string, value: string): void {
    this.postJson(path, {value}).catch((e) => this.emitError(e))
  }

  private async getJson(path: string): Promise<unknown> {
    const response = await this.internet.fetch(this.baseUrl + path, {method: "GET", headers: this.headers()})
    return this.parse(response)
  }

  private async postJson(path: string, body: object): Promise<unknown> {
    const response = await this.internet.fetch(this.baseUrl + path, {
      method: "POST", headers: this.headers(), body: JSON.stringify(body),
    })
    return this.parse(response)
  }

  private headers(): {[key: string]: string} {
    const headers: {[key: string]: string} = {"Content-Type": "application/json"}
    if (this.token.length > 0) headers.Authorization = "Bearer " + this.token
    return headers
  }

  private async parse(response: Response): Promise<unknown> {
    const text = await response.text()
    if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}: ${text}`)
    return text.length > 0 ? JSON.parse(text) : {}
  }

  private connectSocket(): void {
    const wsBase = this.baseUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:")
    const query = this.token.length > 0 ? "?token=" + encodeURIComponent(this.token) : ""
    let socket: WebSocket
    try {
      socket = this.internet.createWebSocket(wsBase + "/v1/events" + query)
    } catch (error) {
      this.scheduleReconnect()
      if (this.reconnectAttempt >= 3) this.emitError(error)
      return
    }
    this.socket = socket
    socket.onopen = () => {
      if (this.socket !== socket) return
      this.reconnectAttempt = 0
    }
    socket.onmessage = (event: WebSocketMessageEvent) => {
      if (this.socket !== socket) return
      if (typeof event.data !== "string") return
      let message: {type: string; data: unknown}
      try {
        message = JSON.parse(event.data) as {type: string; data: unknown}
      } catch (_) {
        return
      }
      if (message.type === "authorization") this.emitAuth(message.data as AuthorizationState)
      else if (message.type === "error") this.emitError(String((message.data as {message?: string}).message || "Backend error"))
      else if (message.type === "message") {
        const live = this.withMediaUrls([message.data as ChatMessage])
        const chatId = live[0]?.chatId || ""
        if (chatId === this.activeChatId) for (const listener of this.messageListeners) listener(chatId, live, "append")
      } else if (message.type === "chatsChanged") this.requestChats()
      else if (message.type === "typing") {
        const data = message.data as {chatId?: string; action?: string}
        for (const listener of this.typingListeners) listener(String(data.chatId || ""), String(data.action || ""))
      }
      else if (message.type === "messagesChanged") {
        const chatId = String((message.data as {chatId?: string}).chatId || "")
        if (chatId === this.activeChatId) this.requestMessages(chatId)
      }
    }
    socket.onerror = () => {
      if (this.socket !== socket || this.reconnectAttempt < 3) return
      this.emitError("Live updates reconnecting")
    }
    socket.onclose = () => {
      if (this.socket !== socket) return
      this.socket = null
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (!this.started || this.reconnectScheduled) return
    this.reconnectScheduled = true
    const delaySeconds = Math.min(30, Math.pow(2, this.reconnectAttempt))
    this.reconnectAttempt += 1
    this.reconnectEvent.reset(delaySeconds)
  }

  private refreshAfterReconnect(): void {
    this.getJson("/v1/auth/state").then((data) => {
      const state = data as AuthorizationState
      this.emitAuth(state)
      if (state.kind !== "ready") return
      this.requestChats()
      if (this.activeChatId.length > 0) this.requestMessages(this.activeChatId)
    }).catch(() => this.scheduleReconnect())
  }

  private withMediaUrls(messages: ChatMessage[]): ChatMessage[] {
    const separator = this.token.length > 0 ? "?token=" + encodeURIComponent(this.token) : ""
    for (const message of messages) {
      const media = message.media
      if (!media) continue
      if (media.fileId) media.mediaUrl = `${this.baseUrl}/v1/media/${media.fileId}${separator}`
      if (media.thumbnailFileId) media.thumbnailUrl = `${this.baseUrl}/v1/media/${media.thumbnailFileId}${separator}`
    }
    return messages
  }

  private emitAuth(state: AuthorizationState): void {
    for (const listener of this.authListeners) listener(state)
  }

  private emitError(error: unknown): void {
    const raw = String((error as {message?: string})?.message || error)
    const message = raw.indexOf("URL is not secure") >= 0
      ? "Local backend blocked. Enable Allow Experimental API in Project Info, then retry."
      : raw
    for (const listener of this.errorListeners) listener(message)
  }
}
