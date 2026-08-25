# Spatial Messenger TDLib backend

Это отдельный процесс. Он держит TDLib, Telegram-сессию и секретные `API_ID` / `API_HASH`.

## Запуск на Mac

```bash
cd "Assets/Backend"
cp .env.example .env
# Вставьте TELEGRAM_API_ID и TELEGRAM_API_HASH в .env
npm install
npm start
```

Проверка: `http://127.0.0.1:8787/health`.

## Где вставить ключи

Только в `Assets/Backend/.env`:

```env
TELEGRAM_API_ID=YOUR_API_ID
TELEGRAM_API_HASH=YOUR_API_HASH
```

Не вставлять их в TypeScript Lens Studio и не коммитить `.env`.

## Для настоящих Spectacles

`127.0.0.1` доступен только Preview на Mac. Очкам нужен публичный `https://` + `wss://` адрес. Позже перенесите эту папку на VPS с постоянным диском для `data/`; добавьте TLS через Caddy/Nginx и задайте `BRIDGE_TOKEN`.

## API

- `GET /health`
- `GET /v1/auth/state`
- `POST /v1/auth/phone` `{ "value": "+336..." }`
- `POST /v1/auth/code` `{ "value": "12345" }`
- `POST /v1/auth/email` `{ "value": "name@example.com" }`
- `POST /v1/auth/email-code` `{ "value": "123456" }`
- `POST /v1/auth/password` `{ "value": "..." }`
- `GET /v1/chats?limit=30`
- `GET /v1/chats/:chatId/messages?limit=30`
- `POST /v1/chats/:chatId/messages` `{ "text": "Hello" }`
- `POST /v1/chats/:chatId/voice` `{ "wavBase64": "...", "durationSeconds": 4.2 }`
- `WS /v1/events`

Voice note записывается в Lens как mono WAV. Backend через локальный `ffmpeg` переводит его в OGG/Opus и отдаёт TDLib как настоящее голосовое сообщение.

При заданном `BRIDGE_TOKEN` передавайте `Authorization: Bearer <token>`; для WebSocket можно использовать `?token=<token>`.
