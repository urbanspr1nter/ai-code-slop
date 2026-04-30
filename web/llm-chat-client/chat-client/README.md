# AI Chat Client

A React + Vite chat client for talking to a local or self-hosted **OpenAI-compatible API**.

This app is designed for local LLM workflows and includes persistent chat history, model selection, streaming responses, markdown rendering, image attachments, and chat import/export.

## Features

- Chat with any OpenAI-compatible `/v1` server
- Streaming and non-streaming response modes
- Model discovery via `/models`
- Persistent chat history stored in IndexedDB
- Per-chat controls for:
  - system prompt
  - temperature
  - reasoning effort
- Global settings for default chat behavior
- Multiple saved server endpoints
- Markdown, GitHub-flavored markdown, math, and code highlighting
- Image attachments via upload or paste
- Regenerate assistant replies and switch between versions
- Favorite, rename, delete, import, and export chats
- Responsive sidebar with bulk chat actions

## Tech Stack

- React 19
- TypeScript
- Vite
- IndexedDB via `idb`
- `react-markdown` + `remark`/`rehype` plugins
- KaTeX for math rendering
- `react-virtuoso` for virtualized message rendering
- `lucide-react` for icons

## Requirements

- Node.js 18+ recommended
- An OpenAI-compatible API server exposing endpoints such as:
  - `GET /v1/models`
  - `POST /v1/chat/completions`

Examples of compatible backends may include local inference servers, self-hosted gateways, or proxies that mimic the OpenAI API format.

## Getting Started

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in your terminal.

## Configuration

By default, the app starts with this API base URL:

```text
http://192.168.1.29:8000/v1
```

You can change this at runtime from **Settings** or from the server selector in the chat UI.

### Supported server behavior

The client expects an OpenAI-style chat API and supports:

- standard text messages
- multimodal user messages with images
- streaming responses
- optional reasoning fields such as `reasoning` or `reasoning_content`

## Available Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint

## Project Structure

```text
src/
  components/
    Chat/
    Layout/
  hooks/
  lib/
```

### Key files

- `src/App.tsx` — main app state and orchestration
- `src/hooks/useAppSettings.ts` — global settings, saved servers, model fetching
- `src/hooks/useChatHistory.ts` — session history management
- `src/lib/db.ts` — IndexedDB persistence layer
- `src/lib/llm.ts` — OpenAI-compatible chat completion client
- `src/lib/export-import.ts` — chat import/export helpers

## Chat Data

Chats and app settings are stored locally in your browser using IndexedDB.

Stored data includes:

- chat sessions and messages
- favorites
- per-chat prompt/temperature/reasoning settings
- global app settings
- saved server endpoints

## Import / Export

The app supports exporting:

- a single chat
- multiple selected chats
- all chats

It also supports importing previously exported chat JSON files.

## Notes

- This project is frontend-only; it does not include a backend server.
- API compatibility depends on your server implementation.
- Browser-stored chat history is local to the current browser profile.

## Development

If you are setting up the repo for the first time:

```bash
npm install
npm run lint
npm run build
```

## License

No license file is currently included in this repository.
