# CLAD Prompt Log

## Project

**Telegram for SPECS 2026** is an early Telegram client for Snap SPECS, built in Lens Studio with CLAD and Codex.

## Goal

I wanted a useful messenger for AR glasses. The user should be able to log in to Telegram, see chats, open a chat, read messages, send a message, and use simple media and chat controls in a clean SnapOS-style interface.

## Main prompts and requests

These are shortened versions of the prompts I gave during the build:

1. “Create a TDLib backend and connect real Telegram login.”
2. “Make the interface look like a normal messenger: chat list, open chat, message bubbles, message input, and chat information.”
3. “Keep the SnapOS style, but make the panels and buttons clean, readable, and logical.”
4. “Add a settings panel with language choices, notifications, account information, and logout.”
5. “Keep the microphone icon visible when the pointer is over the button. Do not add a second button.”
6. “Make message bubbles fit the text, with a maximum width and correct wrapping.”
7. “Open images full screen and allow gallery navigation. Show media and video-note messages.”
8. “Fix audio messages so play and pause work, and crop video-note circles correctly.”
9. “Prepare the project for open source. Remove secrets, add a safe README, and check the Git files.”

## What CLAD helped build

- A local Node.js TDLib bridge in `Assets/Backend`.
- Real Telegram authentication and chat/message loading.
- Lens Studio scripts for login, chat state, chat lists, messages, settings, and remote backend calls.
- A spatial messenger UI with movable panels, chat bubbles, icons, settings, chat details, and media previews.
- A safe `.env.example`, `.gitignore`, README, and GitHub-ready project structure.

## Examples of the iterative workflow

### Example 1: microphone button

The first hover style hid the microphone icon and looked like a second button. I reported the problem with a screenshot. CLAD changed the hover state so the same icon stays visible and only the button color changes.

### Example 2: message bubbles

Some messages were clipped and the bubbles had too much empty space. I asked for full text, safe wrapping, and a maximum bubble width. CLAD updated the message layout and sizing rules.

### Example 3: media messages

I asked for full-screen image viewing, gallery navigation, and correct circular video notes. CLAD added the media view flow and adjusted the circle clipping and play controls.

### Example 4: secure release

I asked how to publish the project safely. CLAD removed the real Telegram API values from the local `.env`, kept placeholders in `.env.example`, ignored TDLib sessions and local keys, updated the README, and pushed a public GitHub repository.

## Workflow used

`Prompt → CLAD edits the Lens project → run the local backend → test in Lens Studio Preview → inspect the result → send a screenshot or bug report → refine the UI/code.`

The work was incremental. I described the user experience and tested it. CLAD/Codex wrote and changed project files, connected the backend, and helped fix issues from each test.

## Current status

The project is an early hackathon prototype, not a production Telegram client. Telegram login, chat lists, text messages, settings, and several media flows are present. Audio message playback is still experimental and may need more work.

No Telegram API keys, TDLib sessions, or local signing keys are included in the public repository.
