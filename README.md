# Telegram for SPECS 2026

Telegram for SPECS 2026 is a very early experimental Telegram client for Snap Spectacles (SPECS) and SnapOS.

It brings a simple spatial messenger interface to AR glasses. The current prototype supports Telegram login, chat lists, message history, text messages, media previews, audio playback, typing updates, chat information, settings, and movable panels.

This is an early hackathon prototype. It is not ready for production or daily use.

## How it works

The Lens does not connect to Telegram directly:

`Snap Spectacles Lens → Node.js TDLib backend → Telegram`

The backend stores the Telegram session and keeps all Telegram API credentials outside the Lens project.

## Requirements

- Lens Studio with a Snap Spectacles / SnapOS project target
- Node.js 20 or newer
- A Telegram account
- Your own Telegram `api_id` and `api_hash`

## Local setup

1. Create a Telegram application at [my.telegram.org](https://my.telegram.org).
2. Open `Assets/Backend`.
3. Copy `.env.example` to `.env`.
4. Add your own credentials:

```env
TELEGRAM_API_ID=YOUR_API_ID
TELEGRAM_API_HASH=YOUR_API_HASH
```

5. Install and start the backend:

```bash
cd Assets/Backend
npm install
npm start
```

6. Open the project in Lens Studio.
7. For Mac Preview, use `http://127.0.0.1:8787` as the backend URL.
8. Complete the Telegram login inside the Lens.

The saved TDLib session opens the chat list automatically on the next launch.

## Testing on Spectacles

`127.0.0.1` only works in Lens Studio Preview on the Mac. Real Spectacles need a public HTTPS/WSS backend with persistent storage. Set a strong `BRIDGE_TOKEN` before exposing the backend to the internet.

## Security

This repository is prepared without live Telegram credentials. Each developer must create a local `.env` from `.env.example` and use their own Telegram API credentials.

Never commit or share:

- `Assets/Backend/.env`
- Telegram `api_id` or `api_hash`
- `BRIDGE_TOKEN`
- TDLib database/session files
- downloaded private Telegram media

Every developer should use their own Telegram API credentials. The Lens itself must never contain these secrets.

## Current status

This project is under active development. Some Telegram features, production authentication, deployment, error handling, and device testing are still incomplete.

Known issue: voice messages and audio messages may not play correctly or may fail to start. Audio playback is still experimental and needs more work.

## Disclaimer

This is an unofficial third-party prototype. It is not affiliated with, endorsed by, or sponsored by Telegram or Snap Inc. Users and contributors must follow the Telegram API Terms of Service and Snap platform rules.
