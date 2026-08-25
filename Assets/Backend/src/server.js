"use strict"

require("dotenv").config()

const http = require("node:http")
const fsSync = require("node:fs")
const fs = require("node:fs/promises")
const path = require("node:path")
const {spawn} = require("node:child_process")
const {URL} = require("node:url")
const ffmpegPath = require("ffmpeg-static")
const {WebSocketServer, WebSocket} = require("ws")
const tdl = require("tdl")
const {getTdjson} = require("prebuilt-tdlib")

const HOST = process.env.HOST || "127.0.0.1"
const PORT = Number(process.env.PORT || 8787)
const API_ID = Number(process.env.TELEGRAM_API_ID || 0)
const API_HASH = process.env.TELEGRAM_API_HASH || ""
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || ""
const DATA_DIR = path.resolve(process.env.TDLIB_DATA_DIR || "./data")

class Inbox {
  constructor() {
    this.waiters = []
  }

  take() {
    return new Promise((resolve, reject) => this.waiters.push({resolve, reject}))
  }

  put(value) {
    const waiter = this.waiters.shift()
    if (!waiter) throw new Error("TDLib is not waiting for this value")
    waiter.resolve(value)
  }
}

const inputs = {
  phone: new Inbox(), code: new Inbox(), email: new Inbox(),
  emailCode: new Inbox(), password: new Inbox(), name: new Inbox(),
}

let client = null
let authState = {kind: "notConfigured"}
let lastError = ""
let loginPromise = null
let restartAfterLogout = false
let tdlConfigured = false
const sockets = new Set()

function normalizeAuth(raw) {
  const type = raw?._ || "unknown"
  switch (type) {
    case "authorizationStateWaitPhoneNumber": return {kind: "waitPhoneNumber"}
    case "authorizationStateWaitCode": return {
      kind: "waitCode",
      expectedLength: raw.code_info?.type?.length || undefined,
      delivery: authCodeDelivery(raw.code_info?.type?._),
    }
    case "authorizationStateWaitEmailAddress": return {kind: "waitEmailAddress"}
    case "authorizationStateWaitEmailCode": return {
      kind: "waitEmailCode",
      emailPattern: raw.code_info?.email_address_pattern || "email",
      expectedLength: raw.code_info?.length || undefined,
    }
    case "authorizationStateWaitPassword": return {
      kind: "waitPassword",
      hint: raw.password_hint || "",
      recoveryEmailPattern: raw.recovery_email_address_pattern || undefined,
    }
    case "authorizationStateWaitOtherDeviceConfirmation": return {
      kind: "waitOtherDeviceConfirmation", link: raw.link || "",
    }
    case "authorizationStateWaitRegistration": return {kind: "waitRegistration"}
    case "authorizationStateReady": return {kind: "ready"}
    case "authorizationStateClosing": return {kind: "closing"}
    case "authorizationStateClosed": return {kind: "closed"}
    default: return {kind: "connecting", tdlibType: type}
  }
}

function authCodeDelivery(type) {
  if (type === "authenticationCodeTypeSms") return "SMS"
  if (type === "authenticationCodeTypeCall") return "a phone call"
  if (type === "authenticationCodeTypeFlashCall") return "a flash call"
  if (type === "authenticationCodeTypeMissedCall") return "a missed call"
  if (type === "authenticationCodeTypeFragment") return "Fragment"
  return "Telegram"
}

function broadcast(type, data) {
  const payload = JSON.stringify({type, data})
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload)
  }
}

function startTdlib() {
  if (!API_ID || !API_HASH || API_HASH.startsWith("PASTE_")) {
    authState = {kind: "notConfigured"}
    return
  }

  if (!tdlConfigured) {
    tdl.configure({tdjson: getTdjson(), verbosityLevel: 1})
    tdlConfigured = true
  }
  client = tdl.createClient({
    apiId: API_ID,
    apiHash: API_HASH,
    databaseDirectory: path.join(DATA_DIR, "database"),
    filesDirectory: path.join(DATA_DIR, "files"),
    tdlibParameters: {
      device_model: "Snap Spectacles via Spatial Messenger",
      system_version: "SnapOS",
      application_version: "0.1.0",
      use_message_database: true,
      use_secret_chats: false,
      system_language_code: "en",
    },
  })

  client.on("error", (error) => {
    lastError = String(error?.message || error)
    console.error("[TDLib]", error)
    broadcast("error", {message: lastError})
  })

  client.on("update", (update) => {
    if (update._ === "updateAuthorizationState") {
      authState = normalizeAuth(update.authorization_state)
      broadcast("authorization", authState)
      if (authState.kind === "closed" && restartAfterLogout) {
        restartAfterLogout = false
        setTimeout(() => {
          client = null
          authState = {kind: "connecting"}
          broadcast("authorization", authState)
          startTdlib()
        }, 300)
      }
    } else if (update._ === "updateNewMessage") {
      broadcast("message", normalizeMessage(update.message))
      broadcast("chatsChanged", {chatId: String(update.message.chat_id)})
    } else if (update._ === "updateChatLastMessage") {
      broadcast("chatsChanged", {chatId: String(update.chat_id)})
    } else if (update._ === "updateMessageContent" || update._ === "updateDeleteMessages") {
      broadcast("messagesChanged", {chatId: String(update.chat_id)})
    } else if (update._ === "updateChatAction") {
      broadcast("typing", {
        chatId: String(update.chat_id),
        action: String(update.action?._ || "chatActionCancel"),
      })
    }
  })

  loginPromise = client.login({
    getPhoneNumber: () => inputs.phone.take(),
    getAuthCode: () => inputs.code.take(),
    getEmailAddress: () => inputs.email.take(),
    getEmailCode: () => inputs.emailCode.take(),
    getPassword: () => inputs.password.take(),
    confirmOnAnotherDevice: (link) => {
      authState = {kind: "waitOtherDeviceConfirmation", link}
      broadcast("authorization", authState)
    },
    getName: () => inputs.name.take(),
  }).catch((error) => {
    lastError = String(error?.message || error)
    broadcast("error", {message: lastError})
  })
}

function textOf(content) {
  if (!content) return ""
  if (content._ === "messageText") return content.text?.text || ""
  if (content._ === "messageVoiceNote") return "Voice message"
  if (content._ === "messageAudio") return content.audio?.title || "Audio"
  if (content._ === "messageVideoNote") return "Video message"
  if (content._ === "messagePhoto") return content.caption?.text || "Photo"
  if (content._ === "messageVideo") return content.caption?.text || "Video"
  return content._ ? content._.replace(/^message/, "") : "Message"
}

function largestPhoto(photo) {
  const sizes = photo?.sizes || []
  return sizes.reduce((best, item) => !best || item.width * item.height > best.width * best.height ? item : best, null)
}

function normalizeMedia(content) {
  if (!content) return undefined
  if (content._ === "messagePhoto") {
    const photo = largestPhoto(content.photo)
    if (!photo) return {kind: "photo"}
    return {kind: "photo", fileId: photo.photo?.id, width: photo.width, height: photo.height, mimeType: "image/jpeg"}
  }
  if (content._ === "messageVideo") {
    const video = content.video
    return {kind: "video", fileId: video?.video?.id, thumbnailFileId: video?.thumbnail?.file?.id,
      duration: video?.duration || 0, width: video?.width || 0, height: video?.height || 0,
      mimeType: video?.mime_type || "video/mp4", fileName: video?.file_name || "video.mp4"}
  }
  if (content._ === "messageVideoNote") {
    const note = content.video_note
    return {kind: "videoNote", fileId: note?.video?.id, thumbnailFileId: note?.thumbnail?.file?.id,
      duration: note?.duration || 0, width: note?.length || 0, height: note?.length || 0, mimeType: "video/mp4"}
  }
  if (content._ === "messageVoiceNote") {
    const voice = content.voice_note
    return {kind: "voice", fileId: voice?.voice?.id, duration: voice?.duration || 0,
      mimeType: voice?.mime_type || "audio/ogg"}
  }
  if (content._ === "messageAudio") {
    const audio = content.audio
    return {kind: "audio", fileId: audio?.audio?.id, thumbnailFileId: audio?.album_cover_thumbnail?.file?.id,
      duration: audio?.duration || 0, mimeType: audio?.mime_type || "audio/mpeg",
      fileName: audio?.file_name || "audio", title: audio?.title || "Audio", performer: audio?.performer || ""}
  }
  return undefined
}

function normalizeMessage(message) {
  return {
    id: String(message.id),
    chatId: String(message.chat_id),
    senderId: String(message.sender_id?.user_id || message.sender_id?.chat_id || ""),
    outgoing: Boolean(message.is_outgoing),
    text: textOf(message.content),
    date: message.date || 0,
    media: normalizeMedia(message.content),
  }
}

async function getChats(limit) {
  requireReady()
  const list = await client.invoke({_: "getChats", chat_list: {_ : "chatListMain"}, limit})
  const chats = await Promise.all((list.chat_ids || []).map((chatId) => client.invoke({_: "getChat", chat_id: chatId})))
  return chats.map((chat) => ({
    id: String(chat.id),
    title: chat.title || "Chat",
    lastMessage: textOf(chat.last_message?.content),
    unreadCount: chat.unread_count || 0,
    date: chat.last_message?.date || 0,
  }))
}

async function getChatInfo(chatId) {
  requireReady()
  const chat = await client.invoke({_: "getChat", chat_id: chatId})
  const result = {
    id: String(chat.id), title: chat.title || "Chat", type: "Telegram chat",
    notificationsMuted: Number(chat.notification_settings?.mute_for || 0) > 0,
  }
  const kind = chat.type?._
  if (kind === "chatTypePrivate" || kind === "chatTypeSecret") {
    const userId = chat.type?.user_id
    const user = await client.invoke({_: "getUser", user_id: userId})
    const full = await client.invoke({_: "getUserFullInfo", user_id: userId}).catch(() => ({}))
    result.title = [user.first_name, user.last_name].filter(Boolean).join(" ") || result.title
    result.type = kind === "chatTypeSecret" ? "Secret chat" : "Private chat"
    if (user.phone_number) result.phone = `+${String(user.phone_number).replace(/^\+/, "")}`
    const username = user.usernames?.active_usernames?.[0]
    if (username) result.username = `@${username}`
    if (full.bio?.text) result.bio = full.bio.text
    result.status = String(user.status?._ || "").replace(/^userStatus/, "").toLowerCase()
  } else if (kind === "chatTypeSupergroup") {
    const group = await client.invoke({_: "getSupergroup", supergroup_id: chat.type.supergroup_id})
    const full = await client.invoke({_: "getSupergroupFullInfo", supergroup_id: chat.type.supergroup_id}).catch(() => ({}))
    result.type = group.is_channel ? "Channel" : "Group"
    result.members = group.member_count || undefined
    const username = group.usernames?.active_usernames?.[0]
    if (username) result.username = `@${username}`
    if (full.description) result.bio = full.description
  } else if (kind === "chatTypeBasicGroup") {
    const group = await client.invoke({_: "getBasicGroup", basic_group_id: chat.type.basic_group_id})
    const full = await client.invoke({_: "getBasicGroupFullInfo", basic_group_id: chat.type.basic_group_id}).catch(() => ({}))
    result.type = "Group"
    result.members = group.member_count || undefined
    if (full.description) result.bio = full.description
  }
  return result
}

async function getMessages(chatId, limit, beforeMessageId = "0") {
  requireReady()
  const messages = []
  const seen = new Set()
  let fromMessageId = beforeMessageId
  let stalled = 0
  for (let attempt = 0; attempt < 8 && messages.length < limit; attempt++) {
    const result = await client.invoke({
      _: "getChatHistory", chat_id: chatId, from_message_id: fromMessageId, offset: 0,
      limit: Math.min(100, limit - messages.length + (fromMessageId === "0" ? 0 : 1)), only_local: false,
    })
    const batch = result.messages || []
    let added = 0
    for (const message of batch) {
      const id = String(message.id)
      if (seen.has(id)) continue
      seen.add(id)
      messages.push(message)
      added++
      if (messages.length >= limit) break
    }
    if (batch.length === 0) break
    const nextFrom = String(batch[batch.length - 1].id)
    stalled = added === 0 || nextFrom === fromMessageId ? stalled + 1 : 0
    fromMessageId = nextFrom
    if (stalled >= 2) break
  }
  return messages.slice(0, limit).map(normalizeMessage).reverse()
}

async function downloadMedia(fileId) {
  requireReady()
  const file = await client.invoke({
    _: "downloadFile", file_id: Number(fileId), priority: 16, offset: 0, limit: 0, synchronous: true,
  })
  const localPath = file?.local?.path
  if (!localPath || !file.local?.is_downloading_completed) {
    throw Object.assign(new Error("Media download failed"), {statusCode: 502})
  }
  return localPath
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return ({".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",
    ".mp4":"video/mp4",".mov":"video/quicktime",".ogg":"audio/ogg",".oga":"audio/ogg",
    ".mp3":"audio/mpeg",".m4a":"audio/mp4"})[ext] || "application/octet-stream"
}

async function sendMessage(chatId, text) {
  requireReady()
  const message = await client.invoke({
    _: "sendMessage",
    chat_id: chatId,
    input_message_content: {
      _: "inputMessageText",
      text: {_: "formattedText", text, entities: []},
      clear_draft: true,
    },
  })
  return normalizeMessage(message)
}

async function setChatAction(chatId, typing) {
  requireReady()
  await client.invoke({
    _: "sendChatAction", chat_id: chatId, message_thread_id: 0,
    action: {_ : typing ? "chatActionTyping" : "chatActionCancel"},
  })
}

async function markRead(chatId, messageId) {
  requireReady()
  await client.invoke({
    _: "viewMessages", chat_id: chatId, message_ids: [Number(messageId)],
    source: {_ : "messageSourceChatList"}, force_read: true,
  })
}

async function runFfmpeg(args) {
  if (!ffmpegPath) throw new Error("ffmpeg binary is unavailable")
  await new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, args, {stdio: ["ignore", "ignore", "pipe"]})
    let errorText = ""
    process.stderr.on("data", (chunk) => { errorText += chunk.toString() })
    process.on("error", reject)
    process.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${errorText.slice(-800)}`)))
  })
}

async function sendVoiceMessage(chatId, wavBase64, durationSeconds) {
  requireReady()
  const wav = Buffer.from(String(wavBase64 || ""), "base64")
  if (wav.length < 45 || wav.length > 2 * 1024 * 1024) {
    throw Object.assign(new Error("Invalid voice recording size"), {statusCode: 400})
  }
  const uploadDir = path.join(DATA_DIR, "uploads")
  await fs.mkdir(uploadDir, {recursive: true})
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const wavPath = path.join(uploadDir, `${unique}.wav`)
  const oggPath = path.join(uploadDir, `${unique}.ogg`)
  await fs.writeFile(wavPath, wav)
  try {
    await runFfmpeg(["-y", "-i", wavPath, "-vn", "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "32k", oggPath])
  } finally {
    await fs.unlink(wavPath).catch(() => {})
  }
  const message = await client.invoke({
    _: "sendMessage",
    chat_id: chatId,
    input_message_content: {
      _: "inputMessageVoiceNote",
      voice_note: {_: "inputFileLocal", path: oggPath},
      duration: Math.max(1, Math.round(Number(durationSeconds) || 1)),
      waveform: "",
      caption: {_: "formattedText", text: "", entities: []},
      self_destruct_type: null,
    },
  })
  setTimeout(() => fs.unlink(oggPath).catch(() => {}), 10 * 60 * 1000)
  return normalizeMessage(message)
}

function requireReady() {
  if (!client || authState.kind !== "ready") throw Object.assign(new Error("Telegram is not ready"), {statusCode: 409})
}

function authorized(req, url) {
  if (!BRIDGE_TOKEN) return true
  const header = req.headers.authorization || ""
  return header === `Bearer ${BRIDGE_TOKEN}` || url.searchParams.get("token") === BRIDGE_TOKEN
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  })
  res.end(body)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
      if (body.length > 3 * 1024 * 1024) reject(Object.assign(new Error("Body too large"), {statusCode: 413}))
    })
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}) } catch { reject(Object.assign(new Error("Invalid JSON"), {statusCode: 400})) }
    })
    req.on("error", reject)
  })
}

const routes = {
  "/v1/auth/phone": inputs.phone,
  "/v1/auth/code": inputs.code,
  "/v1/auth/email": inputs.email,
  "/v1/auth/email-code": inputs.emailCode,
  "/v1/auth/password": inputs.password,
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  if (req.method === "OPTIONS") return sendJson(res, 204, {})
  if (url.pathname === "/health") return sendJson(res, 200, {
    ok: true, configured: Boolean(API_ID && API_HASH && !API_HASH.startsWith("PASTE_")),
    auth: authState, error: lastError || undefined,
  })
  if (!authorized(req, url)) return sendJson(res, 401, {error: "Unauthorized"})

  try {
    if (req.method === "GET" && url.pathname === "/v1/auth/state") return sendJson(res, 200, authState)
    if (req.method === "POST" && url.pathname === "/v1/auth/logout") {
      requireReady()
      restartAfterLogout = true
      await client.invoke({_: "logOut"})
      return sendJson(res, 202, {ok: true})
    }
    if (req.method === "POST" && routes[url.pathname]) {
      const body = await readJson(req)
      routes[url.pathname].put(String(body.value || ""))
      return sendJson(res, 202, {ok: true})
    }
    if (req.method === "POST" && url.pathname === "/v1/auth/name") {
      const body = await readJson(req)
      inputs.name.put({firstName: String(body.firstName || ""), lastName: String(body.lastName || "")})
      return sendJson(res, 202, {ok: true})
    }
    if (req.method === "GET" && url.pathname === "/v1/chats") {
      return sendJson(res, 200, {chats: await getChats(Math.min(Number(url.searchParams.get("limit") || 30), 100))})
    }
    const infoMatch = url.pathname.match(/^\/v1\/chats\/(-?\d+)\/info$/)
    if (infoMatch && req.method === "GET") {
      return sendJson(res, 200, await getChatInfo(infoMatch[1]))
    }
    const messageMatch = url.pathname.match(/^\/v1\/chats\/(-?\d+)\/messages$/)
    if (messageMatch && req.method === "GET") {
      return sendJson(res, 200, {messages: await getMessages(messageMatch[1],
        Math.min(Number(url.searchParams.get("limit") || 30), 100), String(url.searchParams.get("before") || "0"))})
    }
    if (messageMatch && req.method === "POST") {
      const body = await readJson(req)
      const text = String(body.text || "").trim()
      if (!text) throw Object.assign(new Error("Message is empty"), {statusCode: 400})
      return sendJson(res, 201, {message: await sendMessage(messageMatch[1], text)})
    }
    const voiceMatch = url.pathname.match(/^\/v1\/chats\/(-?\d+)\/voice$/)
    if (voiceMatch && req.method === "POST") {
      const body = await readJson(req)
      return sendJson(res, 201, {
        message: await sendVoiceMessage(voiceMatch[1], body.wavBase64, body.durationSeconds),
      })
    }
    const actionMatch = url.pathname.match(/^\/v1\/chats\/(-?\d+)\/action$/)
    if (actionMatch && req.method === "POST") {
      const body = await readJson(req)
      await setChatAction(actionMatch[1], Boolean(body.typing))
      return sendJson(res, 202, {ok: true})
    }
    const readMatch = url.pathname.match(/^\/v1\/chats\/(-?\d+)\/read$/)
    if (readMatch && req.method === "POST") {
      const body = await readJson(req)
      await markRead(readMatch[1], String(body.messageId || "0"))
      return sendJson(res, 202, {ok: true})
    }
    const mediaMatch = url.pathname.match(/^\/v1\/media\/(\d+)$/)
    if (mediaMatch && req.method === "GET") {
      const filePath = await downloadMedia(mediaMatch[1])
      const stat = await fs.stat(filePath)
      res.writeHead(200, {"Content-Type": contentTypeFor(filePath), "Content-Length": stat.size,
        "Cache-Control": "private, max-age=86400", "Access-Control-Allow-Origin": "*"})
      return fsSync.createReadStream(filePath).pipe(res)
    }
    sendJson(res, 404, {error: "Not found"})
  } catch (error) {
    sendJson(res, error.statusCode || 500, {error: String(error.message || error)})
  }
})

const wss = new WebSocketServer({noServer: true})
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  if (url.pathname !== "/v1/events" || !authorized(req, url)) return socket.destroy()
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws))
})

wss.on("connection", (socket) => {
  sockets.add(socket)
  socket.send(JSON.stringify({type: "authorization", data: authState}))
  socket.on("close", () => sockets.delete(socket))
})

startTdlib()
server.listen(PORT, HOST, () => {
  console.log(`[Spatial Messenger] TDLib bridge: http://${HOST}:${PORT}`)
  if (!API_ID || !API_HASH || API_HASH.startsWith("PASTE_")) {
    console.log("[Spatial Messenger] Add TELEGRAM_API_ID and TELEGRAM_API_HASH to .env")
  }
})

async function shutdown() {
  server.close()
  if (client) await client.close().catch(() => {})
  await loginPromise?.catch(() => {})
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
