import {SpatialMessengerAuthUI} from "./SpatialMessengerAuthUI"
import {AuthorizationState} from "./SpatialMessengerModels"
import {SpatialMessengerMockTelegramService} from "./SpatialMessengerMockTelegramService"
import {SpatialMessengerRemoteTelegramService} from "./SpatialMessengerRemoteTelegramService"
import {SpatialMessengerShellUI} from "./SpatialMessengerShellUI"
import {SpatialMessengerStore} from "./SpatialMessengerStore"
import {TelegramService} from "./SpatialMessengerTelegramService"

/** Owns app flow. It never renders UI and never knows raw TDLib JSON. */
@component
export class SpatialMessengerMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Spatial Messenger – App Controller</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Spatial Messenger auth UI component")
  authUI!: SpatialMessengerAuthUI
  @input
  @hint("Compact chats and messages UI component")
  shellUI!: SpatialMessengerShellUI
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Use safe demo values when Preview cannot inject the Specs keyboard")
  demoAutoFill: boolean = true
  @input
  @hint("Mock Preview only: open chats immediately. Real backend always shows login")
  previewStartInChats: boolean = true
  @input
  @hint("Preview visual check only: automatically open the first mock chat")
  previewOpenFirstChat: boolean = false
  @input
  @hint("Use Assets/Backend instead of deterministic Preview data")
  useRemoteBackend: boolean = false
  @input
  @hint("Mac Preview: http://127.0.0.1:8787. Device: public HTTPS URL")
  backendBaseUrl: string = "http://127.0.0.1:8787"
  @input
  @hint("Optional temporary bridge token. Never put Telegram API_HASH here")
  bridgeToken: string = ""
  @ui.group_end

  private store = new SpatialMessengerStore()
  private service!: TelegramService
  private state: AuthorizationState = {kind: "welcome"}
  private previewChatOpened: boolean = false
  private serviceStarted: boolean = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    if (!this.authUI || !this.shellUI) {
      console.error("[SpatialMessenger] UI is not wired")
      return
    }
    this.service = this.useRemoteBackend
      ? new SpatialMessengerRemoteTelegramService(this, this.backendBaseUrl, this.bridgeToken)
      : new SpatialMessengerMockTelegramService(this.previewStartInChats)
    this.authUI.onPrimary.add(() => this.handlePrimary())
    this.authUI.onBack.add(() => this.handleBack())
    this.shellUI.onChatSelected.add((chatId) => {
      this.service.requestMessages(chatId)
      this.service.requestChatInfo(chatId)
    })
    this.shellUI.onLoadOlder.add((request) => this.service.requestOlderMessages(request.chatId, request.beforeMessageId))
    this.shellUI.onSend.add((request) => this.service.sendMessage(request.chatId, request.text))
    this.shellUI.onVoice.add((request) => {
      this.service.sendVoiceMessage(request.chatId, request.wavBase64, request.durationSeconds)
    })
    this.shellUI.onTyping.add((request) => this.service.setTyping(request.chatId, request.typing))
    this.shellUI.onRead.add((request) => this.service.markRead(request.chatId, request.messageId))
    this.shellUI.onLogout.add(() => this.service.logout())
    this.service.subscribeChats((chats) => this.store.setChats(chats))
    this.service.subscribeMessages((chatId, messages, mode) => {
      this.shellUI.setMessages(chatId, messages, mode)
      if (mode === "append" && messages.length === 1 && messages[0].outgoing) this.shellUI.setConnectionLabel("Sent")
    })
    this.service.subscribeError((message) => {
      this.store.setError(message)
      this.authUI.showError(message)
      this.shellUI.showError(message)
    })
    this.service.subscribeTyping((chatId, action) => this.shellUI.setTyping(chatId, action))
    this.service.subscribeChatInfo((info) => this.shellUI.setChatInfo(info))
    this.service.subscribeAuthorization((state) => {
      this.state = state
      this.store.setAuthorization(state)
      if (state.kind === "ready") this.service.requestChats()
    })
    this.store.subscribe((snapshot) => {
      this.authUI.showAuthorization(snapshot.authorization)
      this.authUI.setVisible(snapshot.phase !== "READY")
      this.shellUI.setVisible(snapshot.phase === "READY")
      this.shellUI.setChats(snapshot.chats)
      if (!this.useRemoteBackend && this.previewOpenFirstChat && !this.previewChatOpened && snapshot.chats.length > 0) {
        this.previewChatOpened = true
        this.shellUI.openFirstChatForPreview()
      }
      this.shellUI.setConnectionLabel(this.useRemoteBackend ? "Telegram • live backend" : "Preview • mock data")
    })
    this.startService()
  }

  private handlePrimary(): void {
    const value = this.valueForPreview(this.authUI.getInputValue())
    if (this.state.kind === "welcome") this.startService()
    else if (this.state.kind === "waitPhoneNumber") this.service.setPhoneNumber(value)
    else if (this.state.kind === "waitCode") this.service.checkCode(value)
    else if (this.state.kind === "waitEmailAddress") this.service.setEmailAddress(value)
    else if (this.state.kind === "waitEmailCode") this.service.checkEmailCode(value)
    else if (this.state.kind === "waitPassword") this.service.checkPassword(value)
  }

  private startService(): void {
    if (this.serviceStarted) return
    this.serviceStarted = true
    this.service.start()
  }

  private valueForPreview(value: string): string {
    if (value.length > 0 || !this.demoAutoFill || this.useRemoteBackend) return value
    if (this.state.kind === "waitPhoneNumber") return "+33612345678"
    if (this.state.kind === "waitCode") return "12345"
    if (this.state.kind === "waitEmailAddress") return "demo@example.com"
    if (this.state.kind === "waitEmailCode") return "123456"
    if (this.state.kind === "waitPassword") return "preview-only"
    return value
  }

  private handleBack(): void {
    if (this.state.kind === "waitPhoneNumber") this.setLocalState({kind: "welcome"})
    else if (this.state.kind === "waitCode") this.setLocalState({kind: "waitPhoneNumber"})
    else if (this.state.kind === "waitEmailAddress") this.setLocalState({kind: "waitCode", expectedLength: 5, delivery: "Telegram app"})
    else if (this.state.kind === "waitEmailCode") this.setLocalState({kind: "waitEmailAddress"})
    else if (this.state.kind === "waitPassword") this.setLocalState({kind: "waitEmailCode", emailPattern: "m***@example.com", expectedLength: 6})
  }

  private setLocalState(state: AuthorizationState): void {
    this.state = state
    this.store.setAuthorization(state)
  }
}
