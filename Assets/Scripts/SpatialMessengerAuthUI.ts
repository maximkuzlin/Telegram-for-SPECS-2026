import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {TextInputField} from "SpectaclesUIKit.lspkg/Scripts/Components/TextInputField/TextInputField"
import {AuthorizationState} from "./SpatialMessengerModels"

const ICON_FORWARD = requireAsset("../Icons/arrow_forward.png") as Texture
const ICON_BACK = requireAsset("../Icons/arrow_back.png") as Texture

type TextRole = "Title1" | "HeadlineXL" | "Body" | "Caption" | "Button"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 82, weight: 700},
  HeadlineXL: {size: 62, weight: 700},
  Body: {size: 44, weight: 500},
  Caption: {size: 41, weight: 500},
  Button: {size: 39, weight: 500},
}
function applyTextRole(text: Text, role: TextRole): void {
  text.size = TYPE_SCALE[role].size
  ;(text as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

@component
export class SpatialMessengerAuthUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Spatial Messenger – Auth UI</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Panel width in centimeters")
  @widget(new SliderWidget(30, 48, 1))
  panelWidth: number = 38
  @input
  @hint("Panel height in centimeters")
  @widget(new SliderWidget(24, 40, 1))
  panelHeight: number = 32
  @ui.group_end

  private titleText!: Text
  private bodyText!: Text
  private statusText!: Text
  private inputField!: TextInputField
  private inputRoot!: SceneObject
  private primaryContent!: ElementContent
  private backRoot!: SceneObject
  private backItem!: FlexItem
  private actionFlex!: FlexLayout
  private currentValue: string = ""
  private initialized: boolean = false
  private viewWidth: number = 30
  private viewHeight: number = 24

  private primaryEvent = new Event<void>()
  private backEvent = new Event<void>()
  get onPrimary(): PublicApi<void> { return this.primaryEvent.publicApi() }
  get onBack(): PublicApi<void> { return this.backEvent.publicApi() }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const frame = this.sceneObject.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false
    frame.allowTranslation = true
    this.viewWidth = Math.min(this.panelWidth, 30)
    this.viewHeight = Math.min(this.panelHeight, 24)
    frame.onInitialized.add(() => {
      frame.innerSize = new vec2(this.viewWidth, this.viewHeight)
      frame.padding = new vec2(1.0, 1.0)
      this.build(frame.contentTransform.getSceneObject())
      this.initialized = true
      this.showAuthorization({kind: "welcome"})
    })
  }

  getInputValue(): string { return this.currentValue.trim() }

  setVisible(visible: boolean): void { this.sceneObject.enabled = visible }

  showError(message: string): void {
    if (!this.initialized) return
    this.statusText.text = message
  }

  showAuthorization(state: AuthorizationState): void {
    if (!this.initialized) return
    this.currentValue = ""
    this.inputField.text = ""
    this.inputRoot.enabled = state.kind !== "welcome" && state.kind !== "ready"
    this.backRoot.enabled = state.kind !== "welcome" && state.kind !== "ready"
    const hasBack = state.kind !== "welcome" && state.kind !== "ready"
    this.backItem.overrideWidth = hasBack ? 10 : 0
    this.actionFlex.columnGap = hasBack ? 1.2 : 0
    this.actionFlex.justifyContent = FlexJustify.Center

    if (state.kind === "welcome") {
      this.setCopy("Spatial Messenger", "Telegram for SnapOS", "Connecting…", "Continue", "default", "")
    } else if (state.kind === "waitPhoneNumber") {
      this.setCopy("Phone number", "Enter country code and phone number.", "Example: +33 6 12 34 56 78", "Continue", "numeric", "+33 …")
    } else if (state.kind === "waitCode") {
      const length = state.expectedLength ? `${state.expectedLength}-digit ` : ""
      this.setCopy("Enter code", `We sent a ${length}code in ${state.delivery}.`, "Type it below", "Continue", "pin", "Code")
    } else if (state.kind === "waitEmailAddress") {
      this.setCopy("Enter email", "Telegram needs your email to continue.", "Type it below", "Continue", "default", "name@example.com")
    } else if (state.kind === "waitEmailCode") {
      this.setCopy("Check email", `We sent a code to ${state.emailPattern}.`, "Type it below", "Continue", "pin", "Email code")
    } else if (state.kind === "waitPassword") {
      this.setCopy("Two-Step Verification", `Password hint: ${state.hint}`, "Password is never stored", "Continue", "password", "Telegram password")
    } else if (state.kind === "ready") {
      this.setCopy("Chats ready", "Telegram is connected.", "Opening chats…", "Open chats", "default", "")
    } else if (state.kind === "connecting") {
      this.setCopy("Connecting", "Starting Telegram…", "Please wait", "Retry", "default", "")
    } else if (state.kind === "closing") {
      this.setCopy("Signing out", "Closing the Telegram session…", "Please wait", "Retry", "default", "")
    } else if (state.kind === "closed") {
      this.setCopy("Restarting", "Preparing a new Telegram login…", "Please wait", "Retry", "default", "")
    } else {
      this.setCopy("Unsupported state", "This auth state is preserved for diagnostics.", "Safe fallback", "Retry", "default", "")
    }
  }

  private setCopy(title: string, body: string, status: string, action: string,
      inputType: "default" | "numeric" | "password" | "pin" | "url", placeholder: string): void {
    this.titleText.text = title
    this.bodyText.text = body
    this.statusText.text = status
    this.primaryContent.text = action
    this.inputField.setInputType(inputType)
    this.inputField.placeholderText = placeholder
  }

  private build(host: SceneObject): void {
    const content = global.scene.createSceneObject("Content")
    content.setParent(host)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    col.autoDiscoverItemsOnStart = false
    col.width = this.viewWidth
    col.height = this.viewHeight
    col.direction = FlexDirection.Column
    col.alignItems = FlexAlign.Stretch
    col.justifyContent = FlexJustify.Start
    col.rowGap = 0.55
    col.paddingTop = 0.8
    col.paddingBottom = 0.8
    col.paddingLeft = 1.0
    col.paddingRight = 1.0

    this.titleText = this.addText(content, "Title", "Title1", 4.2)
    this.bodyText = this.addText(content, "Body", "Body", 3.6, true)
    this.statusText = this.addText(content, "Status", "Caption", 2.2)
    this.addInput(content)
    this.addButtons(content)
  }

  private addText(parent: SceneObject, name: string, role: TextRole, height: number, wrap: boolean = false): Text {
    const root = global.scene.createSceneObject(name)
    root.setParent(parent)
    const text = root.createComponent("Component.Text") as Text
    text.depthTest = true
    applyTextRole(text, role)
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Overflow
    text.verticalOverflow = VerticalOverflow.Overflow
    text.layoutRect = Rect.create(-0.5, 0.5, -height / 2, height / 2)
    const item = root.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = height
    const flex = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (flex) flex.addItems([item])
    return text
  }

  private addInput(parent: SceneObject): void {
    this.inputRoot = global.scene.createSceneObject("AuthInput")
    this.inputRoot.setParent(parent)
    this.inputField = this.inputRoot.createComponent(TextInputField.getTypeName()) as TextInputField
    this.inputField.size = new vec3(this.viewWidth - 4.0, 3.8, 1)
    this.inputField.actionSlot = "none"
    this.inputField.showClearButton = true
    this.inputField.onTextChanged.add((value: string) => { this.currentValue = value })
    this.inputField.onReturnKeyPressed.add(() => this.primaryEvent.invoke())
    const item = this.inputRoot.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Center
    item.overrideHeight = 3.8
    const flex = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (flex) flex.addItems([item])
  }

  private addButtons(parent: SceneObject): void {
    const row = global.scene.createSceneObject("Actions")
    row.setParent(parent)
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    this.actionFlex = rowFlex
    rowFlex.autoDiscoverItemsOnStart = false
    rowFlex.width = this.viewWidth - 2.0
    rowFlex.height = 3.8
    rowFlex.direction = FlexDirection.Row
    rowFlex.alignItems = FlexAlign.Center
    rowFlex.justifyContent = FlexJustify.Center
    rowFlex.columnGap = 1.2
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.alignSelf = FlexAlignSelf.Stretch
    rowItem.overrideHeight = 3.8
    const outer = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (outer) outer.addItems([rowItem])

    this.backRoot = this.addButton(row, "Back", ICON_BACK, 10, () => this.backEvent.invoke())
    this.backItem = this.backRoot.getComponent(FlexItem.getTypeName()) as FlexItem
    const primary = this.addButton(row, "Continue", ICON_FORWARD, 14, () => this.primaryEvent.invoke())
    this.primaryContent = primary.getComponent(ElementContent.getTypeName()) as ElementContent
  }

  private addButton(parent: SceneObject, label: string, icon: Texture, width: number, handler: () => void): SceneObject {
    const root = global.scene.createSceneObject(label)
    root.setParent(parent)
    const button = root.createComponent(Button.getTypeName()) as Button
    button.size = new vec3(width, 3.6, 1)
    const content = root.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = label
    content.textSize = TYPE_SCALE.Button.size
    content.leadingIcon = icon
    content.spacing = 0.5
    content.contentAlignment = "center"
    const item = root.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = width
    item.overrideHeight = 3.6
    const flex = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (flex) flex.addItems([item])
    button.onTriggerUp.add(handler)
    return root
  }
}
