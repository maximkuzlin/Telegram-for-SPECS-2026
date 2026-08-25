# Project status

## Working

- SPECS 27 preview target
- Perspective camera + World Device Tracking
- Spectacles Interaction Kit and Spectacles UIKit
- Modular TelegramService / Store / UI architecture
- Mock auth flow: welcome, phone, Telegram code, email, email code, password, ready
- Native UIKit TextInputField keyboard types for numeric, pin, text, and password
- Preview hand interaction verified from Welcome through Chats ready

## Partially working

- Phone input currently uses UIKit numeric mode; dedicated Phone mode needs a direct TextInputSystem controller.
- Real TDLib bridge and Lens adapter are written; real credentials are not inserted yet.

## Added

- TDLib bridge scaffold: `Assets/Backend`
- Compact scrollable chat list and message view
- Composer, send, voice action, and chat info view
- Remote HTTPS/WSS Telegram service adapter
- Snap Cloud hybrid architecture note
- Shared UI rules and Snapchat-yellow / Telegram-blue message bubbles

## Planned

- Insert backend-only Telegram credentials and run end-to-end login
- Add microphone capture and voice upload/send
- Add reconnect/backoff and production short-lived tokens
