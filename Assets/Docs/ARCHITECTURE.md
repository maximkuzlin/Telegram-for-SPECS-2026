# Spatial Messenger architecture

Current decision: remote TDLib bridge.

Why: TDLib needs native C++17, OpenSSL, zlib, threads, sockets, and writable persistent database storage. SpecsNDK is not installed in this workspace, CMake is missing, and current available Specs documentation does not confirm the full native socket/storage contract TDLib needs. We keep the UI behind `TelegramService`, so a future `NativeTelegramService` can replace the remote adapter.

Flow:

`TDLib backend → HTTPS/WSS → TelegramService → Store → Spatial UI`

The current Lens build uses `SpatialMessengerMockTelegramService` only. It is clearly marked as mock mode.

## Secrets — insert later

Do not put Telegram secrets in Lens Studio scripts.

When the backend is created, add a backend-only `.env` file:

```env
# INSERT YOUR VALUES HERE LATER — BACKEND ONLY
TELEGRAM_API_ID=PASTE_HERE
TELEGRAM_API_HASH=PASTE_HERE
```

Commit only `.env.example`. Never commit the real `.env`.

## Snap Cloud / Supabase

Рекомендуемая схема:

`Lens → Snap Cloud auth/config → TDLib worker on VPS → Telegram`

Snap Cloud подходит для Snapchat sign-in, настроек, связи Snap-user ↔ Telegram-session, коротких токенов, Storage и Realtime. Сам TDLib остаётся в отдельном native worker: ему нужен постоянный процесс и постоянный диск с encrypted session database.

Для MVP Lens может ходить прямо в `Assets/Backend` по HTTPS/WSS. Позже Snap Cloud выдаёт короткий токен, а VPS проверяет его. Telegram `API_ID` и `API_HASH` всегда остаются только в `.env` worker-а.
