# AI Studio

Cross-platform desktop LLM chat client. Connects to remote OpenAI-compatible endpoints (llama.cpp, ollama, vllm, etc). Does NOT run models locally — just a client.

## Tech Stack

- **Electron 41** — desktop shell (Node.js backend, Chromium renderer)
- **Svelte 5** — frontend UI (runes: `$state`, `$derived`, `$effect` — NOT SvelteKit, NOT `$:` reactive statements)
- **TypeScript** — everything, frontend and backend
- **Tailwind CSS v4** — styling (`@import "tailwindcss"` + `@theme {}` block — NOT v3 config files)
- **better-sqlite3** — persistence (sync SQLite from Node.js, rebuilt for Electron via `@electron/rebuild`)
- **marked + highlight.js + DOMPurify** — markdown rendering with Catppuccin Mocha code theme
- **@modelcontextprotocol/sdk** — MCP client (stdio transport)
- **archiver** — zip export of user data
- **vite + vite-plugin-electron** — build tooling
- **electron-builder** — packaging for Windows (.msi), Mac (.dmg), Linux (.AppImage, .deb)

## Project Structure

```
src/
  main/              # Electron main process (Node.js)
    db/
      schema.ts      # SQLite schema + migrations
      queries.ts     # All CRUD operations, folder export, DB import/export
    llm/
      client.ts      # OpenAI-compatible API client, streaming, tool call loop
    mcp/
      manager.ts     # MCP server lifecycle, tool discovery, tool execution
    index.ts         # Window management, all IPC handlers, defaults management
    preload.ts       # Context bridge (renderer ↔ main)
  renderer/          # Svelte frontend
    lib/
      components/
        ChatView.svelte      # Main chat canvas, streaming, tool/thinking traces, input bar
        ChatMessage.svelte   # Individual message bubble with edit/regenerate, thinking parse
        Sidebar.svelte       # Left sidebar: folders, conversations, new chat, export/import
        RightSidebar.svelte  # Right panel: system prompt editor, sampling sliders, MCP config
        Settings.svelte      # Modal: defaults, endpoints, system prompts, sampling presets
        Toast.svelte         # Toast notification system
      stores/
        app.svelte.ts  # All reactive state, loaders, toast system
      markdown.ts      # Markdown renderer with copy button delegation
    App.svelte         # Root layout: sidebars + chat + settings modal + toast
    main.ts            # Svelte mount entry point
    app.css            # Global styles, Tailwind theme, markdown/code prose, emoji support
    globals.d.ts       # Window.api type declarations
    index.html         # HTML shell
  shared/
    types.ts           # All interfaces shared between main + renderer
```

## Commands

- `npm run dev` — start dev server with hot reload + Electron
- `npm run build` — production build (renderer + main + preload)
- `npm run check` — svelte type checking
- `npm run dist:linux` — package for Linux (.AppImage + .deb)
- `npm run dist:win` — package for Windows (.msi + portable)
- `npm run dist:mac` — package for macOS (.dmg)
- `npm run dist` — package for current platform

## Architecture

### IPC Flow
All data flows: renderer `window.api.*` → preload `ipcRenderer.invoke` → main `ipcMain.handle` → queries/llm/mcp

### Streaming
- Per-request channels (`stream-{timestamp}`)
- Main sends chunks via `webContents.send(channelId, chunk)`
- Renderer subscribes via `window.api.onStreamChunk(channelId, cb)`
- `StreamChunk` types: `delta`, `done`, `error`, `tool_call`, `tool_result`
- Streaming is scoped to conversation ID — switching chats doesn't leak or abort

### Database
- SQLite via better-sqlite3, lives in Electron `userData` directory
- Tables: `folders`, `endpoints`, `system_prompts`, `sampling_presets`, `conversations`, `messages`
- Row mappers convert snake_case DB columns to camelCase TS types
- Schema migrations use `PRAGMA table_info` checks for safe column additions

### MCP
- Config stored in `userData/mcp.json`
- Servers spawned as stdio child processes via `@modelcontextprotocol/sdk`
- Tools passed to LLM via OpenAI `tools` parameter + system prompt fallback
- Tool call loop: non-streaming for tool rounds, streaming for final response (max 10 rounds)
- Tool activity shown as colored cards in chat (blue=calling, green=done)

### State Management
- Single `appState` object in `app.svelte.ts` using Svelte 5 `$state` runes
- Includes: data (endpoints, conversations, messages, folders, etc.), UI state (streaming, sidebars, toasts), perf stats
- `systemPromptVersion` counter triggers re-fetch of effective system prompt in ChatView

### User Data
- `userData/ai-studio.db` — SQLite database
- `userData/mcp.json` — MCP server config
- `userData/defaults.json` — default endpoint, system prompt, sampling preset for new chats
- Export: individual DB, full zip of userData, folder conversations as JSON (OpenAI API format with vision support)

## Key Patterns

- Svelte 5 runes only: `$state`, `$derived`, `$effect`, `$props`, `$snippet`
- Tailwind v4: custom colors in `@theme {}`, use semantic names (`bg-bg-primary`, `text-text-muted`, `bg-bg-btn`)
- IPC channels: `{entity}:{action}` naming (e.g. `endpoints:list`, `messages:create`, `chat:send`)
- Toast feedback: call `showToast('message')` after every save/delete/apply action
- Buttons: accent (purple) for primary actions, `bg-bg-btn` for secondary, icon-only with tooltips for compact actions
- Sidebar toggles: hamburger (left) and gear (right) in toolbar, highlighted when panel is open
- Keyboard: Ctrl+Enter to send messages, Escape to cancel edits
- Thinking traces: `<think>...</think>` tags parsed from model output, shown as collapsible amber cards
- System prompt banner: collapsible violet card at top of chat showing effective prompt (user + MCP tools)

## Build Notes

- `postinstall` script runs `electron-rebuild -o better-sqlite3` to compile native module for Electron's Node version
- `archiver` and `@modelcontextprotocol/sdk` must be in vite external list for main process build
- Emoji rendering requires `fonts-noto-color-emoji` on Linux (installed separately), CSS uses `@font-face` with `unicode-range` to avoid spacing issues
- WSLg needs: `libgtk-3-0 libnss3 libatk-bridge2.0-0 libgbm1 libasound2t64 libnspr4` etc. for Electron
