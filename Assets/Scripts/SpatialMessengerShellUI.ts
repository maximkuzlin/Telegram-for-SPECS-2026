import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {Switch} from "SpectaclesUIKit.lspkg/Scripts/Components/Switch/Switch"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {ScrollWindow} from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"
import {TextInputField} from "SpectaclesUIKit.lspkg/Scripts/Components/TextInputField/TextInputField"
import {RoundedRectangle, RoundedRectBlendMode} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {ChatInfo, ChatMessage, ChatSummary, MessageMedia} from "./SpatialMessengerModels"
import {MessageBatchMode, ReadRequest, TypingRequest} from "./SpatialMessengerTelegramService"

const ICON_BACK = requireAsset("../Icons/arrow_back.png") as Texture
const ICON_FORWARD = requireAsset("../Icons/arrow_forward.png") as Texture
const ICON_MIC = requireAsset("../Icons/mic.png") as Texture
const ICON_STOP = requireAsset("../Icons/stop.png") as Texture
const ICON_INFO = requireAsset("../Icons/info.png") as Texture
const ICON_PHOTO = requireAsset("../Icons/image.png") as Texture
const ICON_VIDEO = requireAsset("../Icons/videocam.png") as Texture
const ICON_PLAY = requireAsset("../Icons/play_arrow.png") as Texture
const ICON_AUDIO = requireAsset("../Icons/graphic_eq.png") as Texture
const ICON_SETTINGS = requireAsset("../Icons/settings.png") as Texture
const MICROPHONE_ASSET = requireAsset("../Audio/SpatialMessengerMicrophone.micaudio") as AudioTrackAsset

type TextRole = "Headline1" | "Headline2" | "Subheadline" | "Body" | "Caption" | "Button"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline1: {size: 54, weight: 700}, Headline2: {size: 48, weight: 700},
  Subheadline: {size: 41, weight: 700}, Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500}, Button: {size: 39, weight: 500},
}
function applyTextRole(text: Text, role: TextRole): void {
  text.size = TYPE_SCALE[role].size
  ;(text as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

type SendRequest = {chatId: string; text: string}
type OlderRequest = {chatId: string; beforeMessageId: string}
export type VoiceRequest = {chatId: string; wavBase64: string; durationSeconds: number}
type LanguageCode = "en" | "fr" | "ru" | "uk" | "de"

const COPY: {[code: string]: {[key: string]: string}} = {
  en: {chats:"Chats", settings:"Settings", account:"Telegram account\nConnected", media:"Media previews", larger:"Larger message text", notifications:"Notifications", data:"Data & storage", privacy:"Privacy & security", about:"About", language:"Language", logout:"Log out", message:"Message"},
  fr: {chats:"Discussions", settings:"Paramètres", account:"Compte Telegram\nConnecté", media:"Aperçus des médias", larger:"Texte des messages agrandi", notifications:"Notifications", data:"Données et stockage", privacy:"Confidentialité et sécurité", about:"À propos", language:"Langue", logout:"Se déconnecter", message:"Message"},
  ru: {chats:"Чаты", settings:"Настройки", account:"Аккаунт Telegram\nПодключён", media:"Превью медиа", larger:"Крупный текст сообщений", notifications:"Уведомления", data:"Данные и память", privacy:"Конфиденциальность", about:"О приложении", language:"Язык", logout:"Выйти", message:"Сообщение"},
  uk: {chats:"Чати", settings:"Налаштування", account:"Акаунт Telegram\nПідключено", media:"Перегляд медіа", larger:"Збільшений текст", notifications:"Сповіщення", data:"Дані та сховище", privacy:"Приватність і безпека", about:"Про застосунок", language:"Мова", logout:"Вийти", message:"Повідомлення"},
  de: {chats:"Chats", settings:"Einstellungen", account:"Telegram-Konto\nVerbunden", media:"Medienvorschau", larger:"Größerer Nachrichtentext", notifications:"Benachrichtigungen", data:"Daten und Speicher", privacy:"Privatsphäre und Sicherheit", about:"Über die App", language:"Sprache", logout:"Abmelden", message:"Nachricht"},
}

/** Compact Telegram-style shell adapted for the Specs focal plane. */
@component
export class SpatialMessengerShellUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Spatial Messenger – Chats</span>')
  @ui.separator
  @ui.group_start("Layout")
  @input @hint("Panel width in centimeters") @widget(new SliderWidget(32, 44, 1))
  panelWidth: number = 38
  @input @hint("Panel height in centimeters") @widget(new SliderWidget(28, 38, 1))
  panelHeight: number = 34
  @ui.group_end

  @ui.separator
  @ui.group_start("Message colors")
  @input @hint("Incoming bubble: Snapchat yellow") @widget(new ColorWidget())
  incomingBubbleColor: vec4 = new vec4(1.0, 0.82, 0.12, 0.22)
  @input @hint("Incoming bubble border") @widget(new ColorWidget())
  incomingBorderColor: vec4 = new vec4(1.0, 0.88, 0.25, 0.9)
  @input @hint("Outgoing bubble: Telegram blue") @widget(new ColorWidget())
  outgoingBubbleColor: vec4 = new vec4(0.18, 0.55, 0.95, 0.3)
  @input @hint("Outgoing bubble border") @widget(new ColorWidget())
  outgoingBorderColor: vec4 = new vec4(0.35, 0.72, 1.0, 0.95)
  @ui.group_end

  @ui.separator
  @ui.group_start("Voice")
  @input @hint("Maximum voice note length") @widget(new SliderWidget(10, 60, 5))
  maxVoiceSeconds: number = 30
  @ui.group_end

  private listPane!: SceneObject
  private chatWindow!: SceneObject
  private chatPane!: SceneObject
  private infoPane!: SceneObject
  private galleryPane!: SceneObject
  private settingsPane!: SceneObject
  private chatRows: SceneObject[] = []
  private chatRowTexts: Text[] = []
  private chats: ChatSummary[] = []
  private messageRows: SceneObject[] = []
  private messageRowItems: FlexItem[] = []
  private messageBubbleHosts: SceneObject[] = []
  private messageBubbles: RoundedRectangle[] = []
  private messageTexts: ElementContent[] = []
  private mediaActionHosts: SceneObject[] = []
  private mediaActionContents: ElementContent[] = []
  private messages: ChatMessage[] = []
  private renderedMessageIds: string[] = []
  private chatTitle!: Text
  private typingText!: Text
  private typingClearEvent!: DelayedCallbackEvent
  private typingStopEvent!: DelayedCallbackEvent
  private localTyping: boolean = false
  private lastTypingSentAt: number = 0
  private lastReadMessageId: string = ""
  private infoTitle!: Text
  private infoBody!: Text
  private galleryImage!: RoundedRectangle
  private galleryTitle!: Text
  private galleryCounter!: Text
  private galleryPhotos: ChatMessage[] = []
  private galleryIndex: number = 0
  private connectionText!: Text
  private inputField!: TextInputField
  private voiceContent!: ElementContent
  private microphone!: MicrophoneAudioProvider
  private captureEvent!: UpdateEvent
  private voiceSlotWaitEvent!: UpdateEvent
  private voiceSlotWired: boolean = false
  private voiceFrames: Int16Array[] = []
  private voiceSamples: number = 0
  private voiceSampleRate: number = 16000
  private isRecording: boolean = false
  private listScroll!: ScrollWindow
  private messageScroll!: ScrollWindow
  private messageColumnFlex!: FlexLayout
  private activeChatId: string = ""
  private activeChatTitle: string = ""
  private initialized: boolean = false
  private wantVisible: boolean = false
  private wantOpenFirstChat: boolean = false
  private loadingOlder: boolean = false
  private historyPagesLoaded: number = 0
  private internet: InternetModule = require("LensStudio:InternetModule")
  private remoteMedia: RemoteMediaModule = require("LensStudio:RemoteMediaModule")
  private mediaAudio!: AudioComponent
  private playingAudioMessageId: string = ""
  private playingAudioSlot: number = -1
  private showMediaPreviews: boolean = true
  private autoplayVideo: boolean = false
  private messageTextScale: number = 1.0
  private notificationsEnabled: boolean = true
  private settingsMain!: SceneObject
  private settingsDetail!: SceneObject
  private settingsDetailTitle!: Text
  private settingsDetailBody!: Text
  private settingsAutoplayRow!: SceneObject
  private settingsTransitionEvent!: DelayedCallbackEvent
  private settingsTransitionToDetail: boolean = false
  private settingsCloseGuardEvent!: DelayedCallbackEvent
  private settingsMainCanClose: boolean = true
  private settingsContentWidth: number = 22.4
  private languageCode: LanguageCode = "en"
  private localizedTexts: {[key: string]: Text[]} = {}
  private languageCaption!: Text
  private languageContents: ElementContent[] = []
  private logoutContent!: ElementContent
  private logoutArmed: boolean = false
  private logoutArmEvent!: DelayedCallbackEvent
  private scrollToBottomPending: boolean = false

  private chatSelectedEvent = new Event<string>()
  private sendEvent = new Event<SendRequest>()
  private voiceEvent = new Event<VoiceRequest>()
  private loadOlderEvent = new Event<OlderRequest>()
  private logoutEvent = new Event<void>()
  private typingEvent = new Event<TypingRequest>()
  private readEvent = new Event<ReadRequest>()
  get onChatSelected(): PublicApi<string> { return this.chatSelectedEvent.publicApi() }
  get onSend(): PublicApi<SendRequest> { return this.sendEvent.publicApi() }
  get onVoice(): PublicApi<VoiceRequest> { return this.voiceEvent.publicApi() }
  get onLoadOlder(): PublicApi<OlderRequest> { return this.loadOlderEvent.publicApi() }
  get onLogout(): PublicApi<void> { return this.logoutEvent.publicApi() }
  get onTyping(): PublicApi<TypingRequest> { return this.typingEvent.publicApi() }
  get onRead(): PublicApi<ReadRequest> { return this.readEvent.publicApi() }

  onAwake(): void {
    this.microphone = MICROPHONE_ASSET.control as MicrophoneAudioProvider
    this.mediaAudio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    this.mediaAudio.setOnFinish(() => this.resetAudioButton())
    this.microphone.sampleRate = 16000
    this.voiceSampleRate = this.microphone.sampleRate
    this.captureEvent = this.createEvent("UpdateEvent") as UpdateEvent
    this.captureEvent.bind(() => this.captureVoiceFrame())
    this.captureEvent.enabled = false
    this.typingClearEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.typingClearEvent.bind(() => { if (this.typingText) this.typingText.text = "" })
    this.typingStopEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.typingStopEvent.bind(() => this.emitLocalTyping(false))
    this.logoutArmEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.logoutArmEvent.bind(() => {
      this.logoutArmed = false
      if (this.logoutContent) this.logoutContent.text = this.tr("logout")
    })
    this.createEvent("OnDestroyEvent").bind(() => this.cancelVoiceRecording())
    this.sceneObject.createComponent("Component.Canvas")
    const frame = this.sceneObject.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false
    frame.allowTranslation = true
    frame.onInitialized.add(() => {
      frame.innerSize = new vec2(this.panelWidth, this.panelHeight)
      frame.padding = new vec2(1.1, 1.1)
      this.buildMainWindow(frame.contentTransform.getSceneObject())
      this.buildChatWindow()
    })
  }

  setVisible(visible: boolean): void {
    this.wantVisible = visible
    if (!this.initialized) return
    this.sceneObject.enabled = visible
    if (visible && !this.activeChatId) this.showList()
  }

  setConnectionLabel(label: string): void {
    if (this.connectionText) this.connectionText.text = label
  }

  setChats(chats: ChatSummary[]): void {
    this.chats = chats.slice()
    if (!this.initialized) return
    this.renderChats()
  }

  private renderChats(): void {
    for (let i = 0; i < this.chatRows.length; i++) {
      const chat = this.chats[i]
      this.chatRows[i].enabled = Boolean(chat)
      if (!chat) continue
      const preview = this.oneLine(chat.lastMessage || "No messages", 42)
      this.chatRowTexts[i].text = `<b>${this.escape(this.oneLine(chat.title, 34))}</b>\n${this.escape(preview)}`
    }
  }

  setMessages(chatId: string, messages: ChatMessage[], mode: MessageBatchMode = "replace"): void {
    if (chatId !== this.activeChatId) return
    const combined = mode === "replace" ? messages : mode === "prepend" ? messages.concat(this.messages) : this.messages.concat(messages)
    const byId: {[id: string]: ChatMessage} = {}
    for (const message of combined) byId[message.id] = message
    this.messages = Object.keys(byId).map((id) => byId[id]).sort((a, b) => a.date === b.date ? this.compareIds(a.id, b.id) : a.date - b.date)
    this.loadingOlder = false
    if (mode === "prepend") this.historyPagesLoaded++
    const visible = this.messages.slice(-this.messageRows.length)
    const firstSlot = 0
    let totalH = 0
    for (let i = 0; i < this.messageRows.length; i++) {
      const message = i >= firstSlot ? visible[i - firstSlot] : undefined
      const bubbleHost = this.messageBubbleHosts[i]
      const mediaAction = this.mediaActionHosts[i]
      this.messageRows[i].enabled = true
      bubbleHost.enabled = Boolean(message)
      mediaAction.enabled = false
      this.renderedMessageIds[i] = message?.id || ""
      if (!message) {
        this.messageRowItems[i].overrideHeight = 0
        continue
      }
      const bubbleH = this.messageHeight(message)
      const bubbleW = this.messageWidth(message)
      this.messageRowItems[i].overrideHeight = bubbleH
      totalH += bubbleH + 0.4
      const p = bubbleHost.getTransform().getLocalPosition()
      const edge = (this.panelWidth - 2.2) / 2 - 0.35
      bubbleHost.getTransform().setLocalPosition(new vec3(message.outgoing ? edge - bubbleW / 2 : -edge + bubbleW / 2, p.y, p.z))
      const actionable = Boolean(message.media)
      if (actionable) {
        mediaAction.enabled = true
        this.mediaActionContents[i].leadingIcon = message.media?.kind === "photo" ? ICON_PHOTO : ICON_PLAY
        mediaAction.getTransform().setLocalPosition(new vec3(message.outgoing ? edge - bubbleW - 1.55 : -edge + bubbleW + 1.55, p.y, p.z + 0.12))
      }
      const bubble = this.messageBubbles[i]
      bubble.size = new vec2(bubbleW, bubbleH - 0.18)
      bubble.cornerRadius = message.media?.kind === "videoNote" ? (bubbleH - 0.18) / 2 : 1.15
      bubble.useTexture = false
      bubble.backgroundColor = message.outgoing ? this.outgoingBubbleColor : this.incomingBubbleColor
      bubble.borderColor = message.outgoing ? this.outgoingBorderColor : this.incomingBorderColor
      const content = this.messageTexts[i]
      content.textSize = TYPE_SCALE.Body.size * this.messageTextScale
      content.padding = {top: 0.25, right: 0.35, bottom: 0.25, left: 0.35}
      content.sizeOverride = new vec2(bubbleW - 0.7, bubbleH - 0.3)
      content.text = this.messageLabel(message)
      this.configureMessageText(content.sceneObject)
      content.leadingIcon = message.media?.kind === "videoNote" ? null : this.iconFor(message.media)
      content.leadingIconSize = message.media && message.media.kind !== "videoNote" ? 2.2 : 0
      this.messageTexts[i].contentAlignment = message.outgoing ? "right" : "left"
      this.loadMediaPreview(i, message)
    }
    this.messageScroll.scrollDimensions = new vec2(this.panelWidth - 2.2, Math.max(totalH, this.panelHeight - 12.2))
    this.messageColumnFlex.height = Math.max(totalH, this.panelHeight - 12.2)
    this.messageColumnFlex.markDirty()
    if (mode !== "prepend") this.scrollToBottomPending = true
    const latestIncoming = this.messages.slice().reverse().find((message) => !message.outgoing)
    if (latestIncoming && latestIncoming.id !== this.lastReadMessageId && this.chatWindow?.enabled) {
      this.lastReadMessageId = latestIncoming.id
      this.readEvent.invoke({chatId: this.activeChatId, messageId: latestIncoming.id})
    }
  }

  openFirstChatForPreview(): void {
    if (!this.initialized) {
      this.wantOpenFirstChat = true
      return
    }
    this.wantOpenFirstChat = false
    if (this.chats.length > 0) this.openChat(0)
  }

  showError(message: string): void { this.setConnectionLabel(message) }

  setChatInfo(info: ChatInfo): void {
    if (!this.initialized || info.id !== this.activeChatId) return
    const lines = [info.type.toUpperCase(), info.title]
    if (info.status) lines.push("", "STATUS", info.status)
    if (info.phone) lines.push("", "PHONE", info.phone)
    if (info.username) lines.push("", "USERNAME", info.username)
    if (info.members) lines.push("", "MEMBERS", String(info.members))
    if (info.bio) lines.push("", "ABOUT", this.oneLine(info.bio, 150))
    lines.push("", "NOTIFICATIONS", info.notificationsMuted ? "Muted" : "On")
    this.infoTitle.text = info.title
    this.infoBody.text = lines.map((line) => this.escape(line)).join("\n")
  }

  setTyping(chatId: string, action: string): void {
    if (!this.initialized || chatId !== this.activeChatId) return
    if (action === "chatActionCancel") {
      this.typingText.text = ""
      return
    }
    if (action === "chatActionTyping") this.typingText.text = "typing…"
    else if (action === "chatActionRecordingVoiceNote") this.typingText.text = "recording voice…"
    else if (action.indexOf("Uploading") >= 0) this.typingText.text = "sending media…"
    else return
    this.typingClearEvent.reset(4.0)
  }

  private buildMainWindow(host: SceneObject): void {
    const content = this.obj(host, "MessengerContent")
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    this.listPane = this.obj(content, "ChatListPane")
    this.settingsPane = this.obj(content, "SettingsPane")
    this.buildListPane()
    this.buildSettingsPane()
  }

  private buildChatWindow(): void {
    const parent = this.sceneObject.getParent()
    this.chatWindow = global.scene.createSceneObject("SpatialMessengerChatWindow")
    if (parent) this.chatWindow.setParent(parent)
    const source = this.sceneObject.getTransform()
    const target = this.chatWindow.getTransform()
    const sourcePosition = source.getLocalPosition()
    target.setLocalPosition(new vec3(sourcePosition.x + this.panelWidth + 8.0, sourcePosition.y, sourcePosition.z))
    target.setLocalRotation(source.getLocalRotation())
    target.setLocalScale(source.getLocalScale())
    this.chatWindow.createComponent("Component.Canvas")
    const frame = this.chatWindow.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false
    frame.allowTranslation = true
    frame.onInitialized.add(() => {
      frame.showCloseButton = true
      frame.innerSize = new vec2(this.panelWidth, this.panelHeight)
      frame.padding = new vec2(1.1, 1.1)
      const content = this.obj(frame.contentTransform.getSceneObject(), "ChatWindowContent")
      content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
      this.chatPane = this.obj(content, "ChatPane")
      this.infoPane = this.obj(content, "InfoPane")
      this.galleryPane = this.obj(content, "GalleryPane")
      this.buildChatPane()
      this.buildInfoPane()
      this.buildGalleryPane()
      frame.closeButton.onTriggerUp.add(() => this.showList())
      this.initialized = true
      this.renderChats()
      this.showList()
      if (this.wantOpenFirstChat) this.openFirstChatForPreview()
      this.sceneObject.enabled = this.wantVisible
    })
  }

  private buildListPane(): void {
    const col = this.makeColumn(this.listPane, this.panelWidth - 2.2, this.panelHeight - 2.2, 0.65)
    const header = this.addFlexChild(col, this.panelWidth - 2.2, 4.0)
    const headerRow = this.makeRow(header, this.panelWidth - 2.2, 4.0, 0.5)
    const title = this.addFlexChild(headerRow, this.panelWidth - 8.0, 4.0, 1)
    this.bindText("chats", this.addText(title, "Chats", "Headline1", this.panelWidth - 8.0, 4.0, "left"))
    const settings = this.addFlexChild(headerRow, 5.0, 4.0)
    settings.name = "SettingsButton"
    const settingsButton = this.addButton(settings, "", 5.0, 4.0, ICON_SETTINGS)
    settingsButton.onTriggerUp.add(() => this.showSettings())

    const viewportH = this.panelHeight - 10.1
    const viewport = this.addFlexChild(col, this.panelWidth - 2.2, viewportH)
    const scroll = viewport.createComponent(ScrollWindow.getTypeName()) as ScrollWindow
    this.listScroll = scroll
    scroll.windowSize = new vec2(this.panelWidth - 2.2, viewportH)
    const rowH = 4.35
    const gap = 0.3
    const chatRowCount = 30
    const totalH = chatRowCount * (rowH + gap) - gap
    scroll.scrollDimensions = new vec2(this.panelWidth - 2.2, totalH)
    scroll.onInitialized.add(() => { scroll.scrollPositionNormalized = new vec2(0, 1) })

    const rows = this.obj(viewport, "ChatRows")
    const rowCol = this.makeColumn(rows, this.panelWidth - 2.2, totalH, gap)
    for (let i = 0; i < chatRowCount; i++) {
      const row = this.addFlexChild(rowCol, this.panelWidth - 2.2, rowH)
      const button = this.addButton(row, "", this.panelWidth - 2.2, rowH)
      const label = this.obj(row, "ChatRowLabel")
      label.getTransform().setLocalPosition(new vec3(0, 0, 0.15))
      const text = this.addText(label, "", "Body", this.panelWidth - 4.0, rowH - 0.25, "left", true)
      button.onTriggerUp.add(() => this.openChat(i))
      this.chatRows.push(row)
      this.chatRowTexts.push(text)
    }

    const status = this.addFlexChild(col, this.panelWidth - 2.2, 0)
    this.connectionText = this.addText(status, "", "Caption", this.panelWidth - 2.2, 0, "left")
    this.connectionText.enabled = false
  }

  private buildChatPane(): void {
    const col = this.makeColumn(this.chatPane, this.panelWidth - 2.2, this.panelHeight - 2.2, 0.55)
    const header = this.addFlexChild(col, this.panelWidth - 2.2, 4.0)
    const headerRow = this.makeRow(header, this.panelWidth - 2.2, 4.0, 0.5)
    const title = this.addFlexChild(headerRow, this.panelWidth - 7.7, 4.0, 1)
    const titleCol = this.makeColumn(title, this.panelWidth - 7.7, 4.0, 0)
    const titleLine = this.addFlexChild(titleCol, this.panelWidth - 7.7, 2.7)
    this.chatTitle = this.addText(titleLine, "Chat", "Headline2", this.panelWidth - 7.7, 2.7, "left")
    const typingLine = this.addFlexChild(titleCol, this.panelWidth - 7.7, 1.3)
    this.typingText = this.addText(typingLine, "", "Caption", this.panelWidth - 7.7, 1.3, "left")
    const info = this.addFlexChild(headerRow, 5.0, 4.0)
    const infoButton = this.addButton(info, "", 5.0, 4.0, ICON_INFO)
    infoButton.onTriggerUp.add(() => this.showInfo())

    const viewportH = this.panelHeight - 12.2
    const viewport = this.addFlexChild(col, this.panelWidth - 2.2, viewportH)
    const scroll = viewport.createComponent(ScrollWindow.getTypeName()) as ScrollWindow
    this.messageScroll = scroll
    scroll.windowSize = new vec2(this.panelWidth - 2.2, viewportH)
    const bubbleH = 3.2
    const gap = 0.4
    const totalH = 80 * (bubbleH + gap) - gap
    scroll.scrollDimensions = new vec2(this.panelWidth - 2.2, totalH)
    scroll.onInitialized.add(() => { scroll.scrollPositionNormalized = new vec2(0, -1) })
    scroll.onScrollEnd.add(() => this.loadOlderIfNeeded())
    const messages = this.obj(viewport, "Messages")
    const messageCol = this.makeColumn(messages, this.panelWidth - 2.2, totalH, gap)
    this.messageColumnFlex = messageCol.getComponent(FlexLayout.getTypeName()) as FlexLayout
    this.messageColumnFlex.onLayoutComplete.add(() => {
      if (!this.scrollToBottomPending) return
      this.scrollToBottomPending = false
      this.messageScroll.scrollPositionNormalized = new vec2(0, -1)
    })
    for (let i = 0; i < 80; i++) {
      const row = this.addFlexChild(messageCol, this.panelWidth - 2.2, bubbleH)
      this.messageRowItems.push(row.getComponent(FlexItem.getTypeName()) as FlexItem)
      const bubbleHost = this.obj(row, "MessageBubble")
      bubbleHost.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
      const bubble = bubbleHost.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
      bubble.size = new vec2(this.panelWidth - 9.0, bubbleH - 0.18)
      bubble.cornerRadius = 1.15
      bubble.blendMode = RoundedRectBlendMode.Normal
      bubble.gradient = false
      bubble.border = true
      bubble.borderSize = 0.08
      bubble.borderSoftness = 0.025
      const content = bubbleHost.createComponent(ElementContent.getTypeName()) as ElementContent
      content.text = ""
      content.textSize = TYPE_SCALE.Body.size
      content.sizeOverride = new vec2(this.panelWidth - 10.2, bubbleH - 0.25)
      this.messageRows.push(row)
      this.messageBubbleHosts.push(bubbleHost)
      this.messageBubbles.push(bubble)
      this.messageTexts.push(content)
      const mediaAction = this.obj(row, "MediaPlayButton")
      mediaAction.getTransform().setLocalPosition(new vec3(0, 0, 0.2))
      const mediaButton = this.addButton(mediaAction, "", 2.8, 2.8, ICON_PLAY)
      mediaButton.onTriggerUp.add(() => this.playMediaAt(i))
      mediaAction.enabled = false
      this.mediaActionHosts.push(mediaAction)
      this.mediaActionContents.push(mediaAction.getComponent(ElementContent.getTypeName()) as ElementContent)
    }

    const composer = this.addFlexChild(col, this.panelWidth - 2.2, 4.2)
    const composerRow = this.makeRow(composer, this.panelWidth - 2.2, 4.2, 0.45)
    const inputWidth = this.panelWidth - 7.85
    const input = this.addFlexChild(composerRow, inputWidth, 4.2, 1)
    this.inputField = input.createComponent(TextInputField.getTypeName()) as TextInputField
    this.inputField.size = new vec3(inputWidth, 4.0, 1)
    this.inputField.placeholderText = this.tr("message")
    this.inputField.onTextChanged.add((value: string) => this.onComposerTextChanged(value))
    this.inputField.actionSlot = "none"
    this.inputField.icon = null
    this.inputField.onReturnKeyPressed.add(() => this.send())
    const send = this.addFlexChild(composerRow, 5.2, 4.2)
    const sendButton = this.addButton(send, "", 5.2, 4.0, ICON_FORWARD)
    sendButton.onTriggerUp.add(() => this.send())
  }

  private buildInfoPane(): void {
    const col = this.makeColumn(this.infoPane, this.panelWidth - 2.2, this.panelHeight - 2.2, 0.9)
    const header = this.addFlexChild(col, this.panelWidth - 2.2, 4.0)
    const row = this.makeRow(header, this.panelWidth - 2.2, 4.0, 0.6)
    const back = this.addFlexChild(row, 5.0, 4.0)
    const backButton = this.addButton(back, "", 5.0, 4.0, ICON_BACK)
    backButton.onTriggerUp.add(() => this.showChat())
    const title = this.addFlexChild(row, this.panelWidth - 8.0, 4.0, 1)
    this.infoTitle = this.addText(title, "Chat info", "Headline1", this.panelWidth - 8.0, 4.0, "left")
    const bodyH = this.panelHeight - 8.5
    const body = this.addFlexChild(col, this.panelWidth - 3.0, bodyH)
    const card = body.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    card.size = new vec2(this.panelWidth - 3.0, bodyH)
    card.cornerRadius = 1.2
    card.backgroundColor = new vec4(0.12, 0.16, 0.22, 0.5)
    card.border = true
    card.borderSize = 0.06
    card.borderColor = new vec4(0.45, 0.65, 0.9, 0.45)
    const textHost = this.obj(body, "ChatInfoText")
    textHost.getTransform().setLocalPosition(new vec3(0, 0, 0.2))
    this.infoBody = this.addText(textHost, "Loading Telegram info…", "Body", this.panelWidth - 5.0, bodyH - 1.4, "left", true)
  }

  private buildGalleryPane(): void {
    const col = this.makeColumn(this.galleryPane, this.panelWidth - 2.2, this.panelHeight - 2.2, 0.6)
    const header = this.addFlexChild(col, this.panelWidth - 2.2, 4.0)
    const row = this.makeRow(header, this.panelWidth - 2.2, 4.0, 0.5)
    const back = this.addFlexChild(row, 5.0, 4.0)
    this.addButton(back, "", 5.0, 4.0, ICON_BACK).onTriggerUp.add(() => this.showChat())
    const title = this.addFlexChild(row, this.panelWidth - 13.2, 4.0, 1)
    this.galleryTitle = this.addText(title, "Photo", "Headline2", this.panelWidth - 13.2, 4.0, "left")
    const counter = this.addFlexChild(row, 7.0, 4.0)
    this.galleryCounter = this.addText(counter, "1 / 1", "Caption", 7.0, 4.0, "right")
    const imageH = this.panelHeight - 12.0
    const imageHost = this.addFlexChild(col, this.panelWidth - 4.0, imageH)
    this.galleryImage = imageHost.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    this.galleryImage.size = new vec2(this.panelWidth - 4.0, imageH)
    this.galleryImage.cornerRadius = 1.2
    this.galleryImage.backgroundColor = new vec4(0.03, 0.04, 0.06, 0.9)
    this.galleryImage.border = true
    this.galleryImage.borderSize = 0.06
    this.galleryImage.borderColor = new vec4(1, 1, 1, 0.3)
    const controls = this.addFlexChild(col, this.panelWidth - 4.0, 4.0)
    const controlsRow = this.makeRow(controls, this.panelWidth - 4.0, 4.0, 1.0)
    const previous = this.addFlexChild(controlsRow, (this.panelWidth - 5.0) / 2, 4.0)
    this.addButton(previous, "Previous", (this.panelWidth - 5.0) / 2, 4.0, ICON_BACK).onTriggerUp.add(() => this.moveGallery(-1))
    const next = this.addFlexChild(controlsRow, (this.panelWidth - 5.0) / 2, 4.0)
    this.addButton(next, "Next", (this.panelWidth - 5.0) / 2, 4.0, ICON_FORWARD).onTriggerUp.add(() => this.moveGallery(1))
    this.galleryPane.enabled = false
  }

  private buildSettingsPane(): void {
    const settingsW = this.panelWidth - 2.2
    const settingsH = this.panelHeight - 2.2
    this.settingsContentWidth = settingsW
    this.settingsPane.getTransform().setLocalPosition(new vec3(0, 0, 0.15))
    this.settingsMain = this.obj(this.settingsPane, "SettingsMain")
    this.settingsMain.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const col = this.makeColumn(this.settingsMain, this.settingsContentWidth, settingsH, 0.4)
    const header = this.addFlexChild(col, this.settingsContentWidth, 3.6)
    const row = this.makeRow(header, this.settingsContentWidth, 3.6, 0.5)
    const back = this.addFlexChild(row, 4.2, 3.6)
    const backButton = this.addButton(back, "", 4.2, 3.6, ICON_BACK)
    backButton.onTriggerUp.add(() => this.showList())
    const title = this.addFlexChild(row, this.settingsContentWidth - 4.7, 3.6, 1)
    this.bindText("settings", this.addText(title, "Settings", "Headline1", this.settingsContentWidth - 4.7, 3.6, "left"))
    const account = this.addFlexChild(col, this.settingsContentWidth, 2.4)
    this.bindText("account", this.addText(account, "Telegram account\nConnected", "Subheadline", this.settingsContentWidth, 2.4, "left", true))
    this.addSettingSwitch(col, "Media previews", this.showMediaPreviews, (on) => {
      this.showMediaPreviews = on
      this.setMessages(this.activeChatId, this.messages, "replace")
    }, "media")
    this.addSettingSwitch(col, "Larger message text", false, (on) => {
      this.messageTextScale = on ? 1.12 : 1.0
      this.setMessages(this.activeChatId, this.messages, "replace")
    }, "larger")
    this.addSettingSwitch(col, "Notifications", this.notificationsEnabled, (on) => { this.notificationsEnabled = on }, "notifications")
    this.addSettingsMenuRow(col, "Data & storage", () => this.openSettingsDetail("Data & storage", "Media loads only when visible.\n\nVideo autoplay can save taps but uses more data.", true), "data")
    this.addSettingsMenuRow(col, "Privacy & security", () => this.openSettingsDetail("Privacy & security", "Telegram sessions are stored only in the local backend folder. API keys are never shown in the Lens.", false), "privacy")
    this.addSettingsMenuRow(col, "About", () => this.openSettingsDetail("About", "Spatial Messenger\nThird-party Telegram client for SnapOS.\nBuilt with TDLib.", false), "about")
    const languageHost = this.addFlexChild(col, this.settingsContentWidth, 1.4)
    this.languageCaption = this.addText(languageHost, "Language · English", "Caption", this.settingsContentWidth, 1.4, "left")
    const languageButtonsHost = this.addFlexChild(col, this.settingsContentWidth, 2.3)
    const languageRow = this.makeRow(languageButtonsHost, this.settingsContentWidth, 2.3, 0.3)
    const languages: {code: LanguageCode; label: string}[] = [
      {code:"en",label:"EN"},{code:"fr",label:"FR"},{code:"ru",label:"RU"},{code:"uk",label:"UK"},{code:"de",label:"DE"},
    ]
    const languageW = (this.settingsContentWidth - 1.2) / 5
    for (const language of languages) {
      const item = this.addFlexChild(languageRow, languageW, 2.3)
      const button = this.addButton(item, language.label, languageW, 2.3)
      const content = item.getComponent(ElementContent.getTypeName()) as ElementContent
      this.languageContents.push(content)
      button.onTriggerUp.add(() => this.applyLanguage(language.code))
    }
    const logoutHost = this.addFlexChild(col, this.settingsContentWidth, 2.6)
    const logoutButton = this.addDangerButton(logoutHost, "Log out", this.settingsContentWidth, 2.6)
    logoutButton.onTriggerUp.add(() => {
      if (!this.logoutArmed) {
        this.logoutArmed = true
        this.logoutContent.text = "Tap again to log out"
        this.logoutArmEvent.reset(3.0)
        return
      }
      this.logoutArmed = false
      this.logoutEvent.invoke()
    })
    this.applyLanguage(this.languageCode)

    this.settingsDetail = this.obj(this.settingsPane, "SettingsDetail")
    this.settingsDetail.getTransform().setLocalPosition(new vec3(0, 0, 0.7))
    const detailCol = this.makeColumn(this.settingsDetail, settingsW, settingsH, 0.65)
    const detailHeader = this.addFlexChild(detailCol, settingsW, 4.0)
    const detailRow = this.makeRow(detailHeader, settingsW, 4.0, 0.5)
    const detailBack = this.addFlexChild(detailRow, 4.5, 4.0)
    const detailBackButton = this.addButton(detailBack, "", 4.5, 4.0, ICON_BACK)
    detailBackButton.onTriggerUp.add(() => this.showSettingsMain())
    const detailTitleHost = this.addFlexChild(detailRow, settingsW - 7.0, 4.0, 1)
    this.settingsDetailTitle = this.addText(detailTitleHost, "Settings", "Headline2", settingsW - 7.0, 4.0, "left")
    const detailBodyHost = this.addFlexChild(detailCol, settingsW - 2.6, 9.0)
    this.settingsDetailBody = this.addText(detailBodyHost, "", "Body", settingsW - 2.6, 9.0, "left", true)
    this.settingsAutoplayRow = this.addSettingSwitch(detailCol, "Autoplay video", this.autoplayVideo, (on) => { this.autoplayVideo = on })
    this.settingsDetail.enabled = false
    this.settingsTransitionEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.settingsTransitionEvent.bind(() => {
      this.settingsMain.enabled = !this.settingsTransitionToDetail
      this.settingsDetail.enabled = this.settingsTransitionToDetail
    })
    this.settingsCloseGuardEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.settingsCloseGuardEvent.bind(() => { this.settingsMainCanClose = true })
    this.settingsPane.enabled = false
  }

  private addSettingSwitch(parent: SceneObject, label: string, initial: boolean, handler: (on: boolean) => void, key: string = ""): SceneObject {
    const host = this.addFlexChild(parent, this.settingsContentWidth, 2.25)
    const row = this.makeRow(host, this.settingsContentWidth, 2.25, 0.7)
    const textHost = this.addFlexChild(row, this.settingsContentWidth - 5.0, 2.25, 1)
    const text = this.addText(textHost, label, "Body", this.settingsContentWidth - 5.0, 2.25, "left")
    if (key) this.bindText(key, text)
    const switchHost = this.addFlexChild(row, 4.3, 2.25)
    const control = switchHost.createComponent(Switch.getTypeName()) as Switch
    control.size = new vec3(3.6, 1.7, 1)
    control.isOn = initial
    control.onFinished.add((on: boolean) => handler(on))
    return host
  }

  private addSettingsMenuRow(parent: SceneObject, label: string, handler: () => void, key: string = ""): void {
    const host = this.addFlexChild(parent, this.settingsContentWidth, 2.15)
    const button = this.addButton(host, "", this.settingsContentWidth, 2.15)
    button.onTriggerUp.add(handler)
    const labelHost = this.obj(host, "SettingsRowLabel")
    labelHost.getTransform().setLocalPosition(new vec3(-1.0, 0, 0.18))
    const text = this.addText(labelHost, label, "Body", this.settingsContentWidth - 4.0, 2.15, "left")
    if (key) this.bindText(key, text)
    const arrowHost = this.obj(host, "SettingsRowArrow")
    arrowHost.getTransform().setLocalPosition(new vec3(this.settingsContentWidth / 2 - 1.1, 0, 0.2))
    const arrow = arrowHost.createComponent(ElementContent.getTypeName()) as ElementContent
    arrow.leadingIcon = ICON_FORWARD
    arrow.leadingIconSize = 1.4
    arrow.sizeOverride = new vec2(2.0, 2.0)
  }

  private openSettingsDetail(title: string, body: string, showAutoplay: boolean): void {
    this.settingsDetailTitle.text = title
    this.settingsDetailBody.text = body
    this.settingsMain.enabled = false
    this.settingsDetail.enabled = false
    this.settingsAutoplayRow.enabled = showAutoplay
    this.settingsTransitionToDetail = true
    this.settingsTransitionEvent.reset(0.2)
  }

  private showSettingsMain(): void {
    this.settingsDetail.enabled = false
    this.settingsMain.enabled = false
    this.settingsTransitionToDetail = false
    this.settingsTransitionEvent.reset(0.2)
    this.settingsMainCanClose = false
    this.settingsCloseGuardEvent.reset(1.0)
  }

  private openChat(index: number): void {
    const chat = this.chats[index]
    if (!chat) return
    this.activeChatId = chat.id
    this.activeChatTitle = chat.title
    this.chatTitle.text = chat.title
    this.infoTitle.text = chat.title
    this.infoBody.text = "Loading Telegram info…"
    this.messages = []
    this.historyPagesLoaded = 0
    this.setMessages(chat.id, [], "replace")
    this.showChat()
    this.chatSelectedEvent.invoke(chat.id)
  }

  private loadOlderIfNeeded(): void {
    if (this.loadingOlder || this.historyPagesLoaded >= 3 || !this.activeChatId || this.messages.length === 0) return
    if (this.messageScroll.scrollPositionNormalized.y < 0.82) return
    this.loadingOlder = true
    this.setConnectionLabel("Loading older messages…")
    this.loadOlderEvent.invoke({chatId: this.activeChatId, beforeMessageId: this.messages[0].id})
  }

  private messageHeight(message: ChatMessage): number {
    if (message.media?.kind === "videoNote") return 7.0
    const text = message.text || ""
    const charsPerLine = Math.max(8, Math.floor((this.messageWidth(message) - 0.7) / 0.56))
    const lines = Math.max(1, text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0))
    const mediaExtra = message.media ? (message.media.kind === "photo" || message.media.kind === "video" ? 3.2 : 1.0) : 0
    return Math.max(3.2, 2.0 + lines * 1.05 + mediaExtra)
  }

  private messageWidth(message: ChatMessage): number {
    if (message.media?.kind === "videoNote") return 7.0
    const longest = (message.text || "").split("\n").reduce((max, line) => Math.max(max, line.length), 0)
    const mediaWidth = message.media ? 15 : 0
    return Math.max(3.6, Math.min(this.panelWidth - 10.0, Math.max(mediaWidth, 1.35 + Math.min(longest, 48) * 0.56)))
  }

  private messageLabel(message: ChatMessage): string {
    const media = message.media
    const prefix = ""
    if (!media) return prefix + this.escape(message.text)
    const duration = media.duration ? ` • ${this.duration(media.duration)}` : ""
    if (media.kind === "videoNote") return ""
    const label = media.kind === "photo" ? "Photo" : media.kind === "video" ? "Video" :
      media.kind === "voice" ? "Voice message" : (media.title || "Audio")
    const caption = message.text && message.text !== label ? `\n${this.escape(message.text)}` : ""
    return `${prefix}${label}${duration}${caption}`
  }

  private iconFor(media?: MessageMedia): Texture | null {
    if (!media) return null
    if (media.kind === "photo") return ICON_PHOTO
    if (media.kind === "video" || media.kind === "videoNote") return ICON_VIDEO
    if (media.kind === "voice" || media.kind === "audio") return ICON_AUDIO
    return ICON_PLAY
  }

  private loadMediaPreview(slot: number, message: ChatMessage): void {
    const media = message.media
    if (!media || !this.showMediaPreviews) return
    const url = media.kind === "photo" ? media.mediaUrl : media.thumbnailUrl
    if (!url) return
    const expectedId = message.id
    this.remoteMedia.loadResourceAsImageTexture(this.internet.makeResourceFromUrl(url), (texture) => {
      if (this.renderedMessageIds[slot] !== expectedId) return
      if (media.kind === "videoNote") {
        this.messageBubbles[slot].texture = texture
        this.messageBubbles[slot].textureMode = "Stretch"
        this.messageBubbles[slot].useTexture = true
      } else {
        this.messageTexts[slot].leadingIcon = texture
        this.messageTexts[slot].leadingIconSize = 5.6
      }
      if (this.autoplayVideo && (media.kind === "video" || media.kind === "videoNote")) this.playMediaAt(slot)
    }, () => {})
  }

  private playMediaAt(slot: number): void {
    const id = this.renderedMessageIds[slot]
    const message = this.messages.find((item) => item.id === id)
    const media = message?.media
    if (!media?.mediaUrl) return
    if (media.kind === "photo") {
      this.openGallery(id)
    } else if (media.kind === "voice" || media.kind === "audio") {
      if (this.playingAudioMessageId === id && this.mediaAudio.isPlaying()) {
        this.mediaAudio.pause()
        this.mediaActionContents[slot].leadingIcon = ICON_PLAY
        this.setConnectionLabel("Audio paused")
        return
      }
      if (this.playingAudioMessageId === id && this.mediaAudio.isPaused()) {
        this.mediaAudio.resume()
        this.mediaActionContents[slot].leadingIcon = ICON_STOP
        this.setConnectionLabel("Playing audio")
        return
      }
      this.resetAudioButton()
      this.mediaAudio.stop(false)
      this.playingAudioMessageId = id
      this.playingAudioSlot = slot
      this.mediaActionContents[slot].leadingIcon = ICON_STOP
      this.setConnectionLabel("Loading audio…")
      this.remoteMedia.loadResourceAsAudioTrackAsset(this.internet.makeResourceFromUrl(media.mediaUrl), (track) => {
        if (this.playingAudioMessageId !== id) return
        this.mediaAudio.audioTrack = track
        this.mediaAudio.play(1)
        this.setConnectionLabel("Playing audio")
      }, (error) => {
        this.resetAudioButton()
        this.showError(error)
      })
    } else if (media.kind === "video" || media.kind === "videoNote") {
      this.setConnectionLabel("Loading video…")
      this.remoteMedia.loadResourceAsVideoTexture(this.internet.makeResourceFromUrl(media.mediaUrl), (texture) => {
        if (this.renderedMessageIds[slot] !== id) return
        if (media.kind === "videoNote") {
          this.messageBubbles[slot].texture = texture
          this.messageBubbles[slot].textureMode = "Stretch"
          this.messageBubbles[slot].useTexture = true
          this.messageTexts[slot].leadingIcon = null
          this.messageTexts[slot].leadingIconSize = 0
        } else {
          this.messageTexts[slot].leadingIcon = texture
          this.messageTexts[slot].leadingIconSize = 6.0
        }
        ;(texture.control as VideoTextureProvider).play(1)
        this.setConnectionLabel("Playing video")
      }, (error) => this.showError(error))
    }
  }

  private resetAudioButton(): void {
    if (this.playingAudioSlot >= 0 && this.playingAudioSlot < this.mediaActionContents.length &&
        this.renderedMessageIds[this.playingAudioSlot] === this.playingAudioMessageId) {
      this.mediaActionContents[this.playingAudioSlot].leadingIcon = ICON_PLAY
    }
    this.playingAudioMessageId = ""
    this.playingAudioSlot = -1
  }

  private openGallery(messageId: string): void {
    this.galleryPhotos = this.messages.filter((message) => message.media?.kind === "photo" && Boolean(message.media.mediaUrl))
    if (this.galleryPhotos.length === 0) return
    this.galleryIndex = Math.max(0, this.galleryPhotos.findIndex((message) => message.id === messageId))
    this.chatPane.enabled = false
    this.infoPane.enabled = false
    this.galleryPane.enabled = true
    this.renderGalleryPhoto()
  }

  private moveGallery(delta: number): void {
    if (this.galleryPhotos.length < 2) return
    this.galleryIndex = (this.galleryIndex + delta + this.galleryPhotos.length) % this.galleryPhotos.length
    this.renderGalleryPhoto()
  }

  private renderGalleryPhoto(): void {
    const message = this.galleryPhotos[this.galleryIndex]
    const url = message?.media?.mediaUrl
    if (!url) return
    this.galleryTitle.text = message.text && message.text !== "Photo" ? this.oneLine(message.text, 34) : "Photo"
    this.galleryCounter.text = `${this.galleryIndex + 1} / ${this.galleryPhotos.length}`
    this.galleryImage.useTexture = false
    const expectedId = message.id
    this.remoteMedia.loadResourceAsImageTexture(this.internet.makeResourceFromUrl(url), (texture) => {
      if (this.galleryPhotos[this.galleryIndex]?.id !== expectedId) return
      this.galleryImage.texture = texture
      this.galleryImage.textureMode = "Fill Height"
      this.galleryImage.useTexture = true
    }, (error) => this.showError(error))
  }

  private duration(seconds: number): string {
    const value = Math.max(0, Math.round(seconds))
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`
  }

  private oneLine(value: string, max: number): string {
    const clean = value.replace(/[\r\n]+/g, " ").trim()
    return clean.length > max ? clean.slice(0, max - 1) + "…" : clean
  }

  private compareIds(a: string, b: string): number {
    const left = Number(a)
    const right = Number(b)
    if (isFinite(left) && isFinite(right)) return left - right
    return a < b ? -1 : a > b ? 1 : 0
  }

  private send(): void {
    const text = this.inputField.text.trim()
    if (!text || !this.activeChatId) return
    this.inputField.text = ""
    this.emitLocalTyping(false)
    this.setConnectionLabel("Sending…")
    this.sendEvent.invoke({chatId: this.activeChatId, text})
  }

  private onComposerTextChanged(value: string): void {
    if (!this.activeChatId) return
    if (value.trim().length === 0) {
      this.emitLocalTyping(false)
      return
    }
    const now = Date.now()
    if (!this.localTyping || now - this.lastTypingSentAt >= 3500) this.emitLocalTyping(true)
    this.typingStopEvent.reset(5.0)
  }

  private emitLocalTyping(typing: boolean): void {
    if (!this.activeChatId || (this.localTyping === typing && !typing)) return
    if (this.localTyping === typing && typing && Date.now() - this.lastTypingSentAt < 3500) return
    this.localTyping = typing
    this.lastTypingSentAt = Date.now()
    this.typingEvent.invoke({chatId: this.activeChatId, typing})
  }

  private toggleVoiceRecording(): void {
    if (this.isRecording) this.finishVoiceRecording()
    else this.startVoiceRecording()
  }

  private wireVoiceActionSlot(): void {
    if (this.voiceSlotWired) return
    const content = this.inputField.actionSlotContent
    if (!content) return
    this.voiceSlotWired = true
    this.voiceSlotWaitEvent.enabled = false
    this.voiceContent = content
    this.voiceContent.leadingIcon = ICON_MIC
    this.voiceContent.leadingIconSize = 2.0
    const voiceButton = content.sceneObject.createComponent(Button.getTypeName()) as Button
    voiceButton.setVariant({theme: "SnapOS3", shape: "Round", style: "PrismGhost"})
    voiceButton.onInitialized.add(() => {
      voiceButton.size = new vec3(3.6, 3.6, 1)
      voiceButton.renderOrder = 20
      content.renderOrder = 21
    })
    voiceButton.onTriggerUp.add(() => this.toggleVoiceRecording())
  }

  private startVoiceRecording(): void {
    if (!this.activeChatId) return
    this.voiceFrames = []
    this.voiceSamples = 0
    this.isRecording = true
    this.inputField.icon = ICON_STOP
    this.voiceContent.leadingIcon = ICON_STOP
    this.setConnectionLabel("Recording • tap Stop to send")
    this.microphone.start()
    this.captureEvent.enabled = true
  }

  private captureVoiceFrame(): void {
    if (!this.isRecording) return
    const frame = new Int16Array(this.microphone.maxFrameSize)
    const shape = this.microphone.getAudioFramePCM16(frame)
    const count = Math.max(0, Math.min(frame.length, Math.round(shape.x)))
    if (count > 0) {
      const copy = new Int16Array(count)
      for (let i = 0; i < count; i++) copy[i] = frame[i]
      this.voiceFrames.push(copy)
      this.voiceSamples += count
    }
    if (this.voiceSamples / this.voiceSampleRate >= this.maxVoiceSeconds) this.finishVoiceRecording()
  }

  private finishVoiceRecording(): void {
    if (!this.isRecording) return
    this.captureEvent.enabled = false
    this.microphone.stop()
    this.isRecording = false
    this.inputField.icon = ICON_MIC
    this.voiceContent.leadingIcon = ICON_MIC
    const duration = this.voiceSamples / this.voiceSampleRate
    if (duration < 0.35) {
      this.voiceFrames = []
      this.setConnectionLabel("Voice note is too short")
      return
    }
    this.setConnectionLabel("Sending voice…")
    const wav = this.makeWav(this.voiceFrames, this.voiceSamples, this.voiceSampleRate)
    this.voiceFrames = []
    this.voiceEvent.invoke({chatId: this.activeChatId, wavBase64: Base64.encode(wav), durationSeconds: duration})
  }

  private cancelVoiceRecording(): void {
    if (!this.isRecording) return
    this.captureEvent.enabled = false
    this.microphone.stop()
    this.isRecording = false
    this.voiceFrames = []
    this.inputField.icon = ICON_MIC
    if (this.voiceContent) this.voiceContent.leadingIcon = ICON_MIC
  }

  private makeWav(frames: Int16Array[], sampleCount: number, sampleRate: number): Uint8Array {
    const bytes = new Uint8Array(44 + sampleCount * 2)
    const view = new DataView(bytes.buffer)
    const word = (offset: number, value: string): void => {
      for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i)
    }
    word(0, "RIFF")
    view.setUint32(4, 36 + sampleCount * 2, true)
    word(8, "WAVE")
    word(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    word(36, "data")
    view.setUint32(40, sampleCount * 2, true)
    let offset = 44
    for (const frame of frames) {
      for (let i = 0; i < frame.length; i++) {
        view.setInt16(offset, frame[i], true)
        offset += 2
      }
    }
    return bytes
  }

  private showList(): void {
    this.cancelVoiceRecording()
    this.emitLocalTyping(false)
    this.listPane.enabled = true
    this.chatPane.enabled = false
    this.infoPane.enabled = false
    this.galleryPane.enabled = false
    this.settingsPane.enabled = false
    if (this.chatWindow) this.chatWindow.enabled = false
    this.activeChatId = ""
  }
  private showChat(): void {
    this.listPane.enabled = true
    this.chatPane.enabled = true
    this.infoPane.enabled = false
    this.galleryPane.enabled = false
    this.settingsPane.enabled = false
    this.chatWindow.enabled = true
  }
  private showInfo(): void {
    this.cancelVoiceRecording()
    this.emitLocalTyping(false)
    this.listPane.enabled = true
    this.chatPane.enabled = false
    this.infoPane.enabled = true
    this.galleryPane.enabled = false
    this.settingsPane.enabled = false
    this.chatWindow.enabled = true
  }

  private showSettings(): void {
    this.cancelVoiceRecording()
    this.listPane.enabled = false
    this.chatPane.enabled = false
    this.infoPane.enabled = false
    this.galleryPane.enabled = false
    this.settingsPane.enabled = true
    this.settingsTransitionToDetail = false
    this.settingsDetail.enabled = false
    this.settingsMain.enabled = true
    this.settingsMainCanClose = true
  }

  private obj(parent: SceneObject, name: string): SceneObject {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    return object
  }

  private makeColumn(parent: SceneObject, width: number, height: number, gap: number): SceneObject {
    return this.makeFlex(parent, FlexDirection.Column, width, height, gap)
  }
  private makeRow(parent: SceneObject, width: number, height: number, gap: number): SceneObject {
    return this.makeFlex(parent, FlexDirection.Row, width, height, gap)
  }
  private makeFlex(parent: SceneObject, direction: FlexDirection, width: number, height: number, gap: number): SceneObject {
    const root = this.obj(parent, direction === FlexDirection.Column ? "Column" : "Row")
    const flex = root.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false
    flex.width = width
    flex.height = height
    flex.direction = direction
    flex.alignItems = FlexAlign.Stretch
    flex.justifyContent = FlexJustify.Start
    if (direction === FlexDirection.Column) flex.rowGap = gap
    else flex.columnGap = gap
    return root
  }

  private addFlexChild(parent: SceneObject, width: number, height: number, grow: number = 0): SceneObject {
    const child = this.obj(parent, "Item")
    const item = child.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = width
    item.overrideHeight = height
    item.flexGrow = grow
    item.flexShrink = 0
    item.alignSelf = FlexAlignSelf.Stretch
    const flex = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (flex) flex.addItems([item])
    return child
  }

  private addButton(parent: SceneObject, label: string, width: number, height: number, icon?: Texture): Button {
    const button = parent.createComponent(Button.getTypeName()) as Button
    button.onInitialized.add(() => { button.size = new vec3(width, height, 1) })
    const content = parent.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = label
    content.textSize = TYPE_SCALE.Button.size
    content.contentAlignment = "center"
    if (icon) {
      content.leadingIcon = icon
      content.leadingIconSize = 1.7
    }
    return button
  }

  private addDangerButton(parent: SceneObject, label: string, width: number, height: number): Button {
    const button = this.addButton(parent, label, width, height)
    this.logoutContent = parent.getComponent(ElementContent.getTypeName()) as ElementContent
    return button
  }

  private bindText(key: string, value: Text): void {
    if (!this.localizedTexts[key]) this.localizedTexts[key] = []
    this.localizedTexts[key].push(value)
  }

  private tr(key: string): string {
    return COPY[this.languageCode]?.[key] || COPY.en[key] || key
  }

  private applyLanguage(code: LanguageCode): void {
    this.languageCode = code
    for (const key of Object.keys(this.localizedTexts)) {
      for (const value of this.localizedTexts[key]) value.text = this.tr(key)
    }
    if (this.inputField) this.inputField.placeholderText = this.tr("message")
    if (this.logoutContent) this.logoutContent.text = this.tr("logout")
    const names: {[code: string]: string} = {en:"English",fr:"Français",ru:"Русский",uk:"Українська",de:"Deutsch"}
    if (this.languageCaption) this.languageCaption.text = `${this.tr("language")} · ${names[code]}`
    const codes = ["EN","FR","RU","UK","DE"]
    for (let i = 0; i < this.languageContents.length; i++) {
      this.languageContents[i].text = `${i === ["en","fr","ru","uk","de"].indexOf(code) ? "• " : ""}${codes[i]}`
    }
  }

  private addText(parent: SceneObject, value: string, role: TextRole, width: number, height: number,
      align: "left" | "center" | "right", rich: boolean = false): Text {
    const text = parent.createComponent("Component.Text") as Text
    text.text = value
    text.enableRichText = rich
    text.depthTest = true
    applyTextRole(text, role)
    text.horizontalAlignment = align === "left" ? HorizontalAlignment.Left : align === "right" ? HorizontalAlignment.Right : HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = rich ? HorizontalOverflow.Wrap : HorizontalOverflow.Overflow
    text.verticalOverflow = VerticalOverflow.Overflow
    text.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    return text
  }

  private escape(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  }

  private configureMessageText(root: SceneObject): void {
    const text = root.getComponent("Component.Text") as Text | null
    if (text) {
      text.horizontalOverflow = HorizontalOverflow.Wrap
      text.verticalOverflow = VerticalOverflow.Overflow
      return
    }
    for (let i = 0; i < root.getChildrenCount(); i++) {
      this.configureMessageText(root.getChild(i))
    }
  }
}
