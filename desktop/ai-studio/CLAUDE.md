# AI Studio

Cross-platform desktop LLM chat client. Connects to remote OpenAI-compatible endpoints (llama.cpp, ollama, vllm, LM Studio, etc). Does NOT run models locally — just a client.

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
- **electron-builder** — packaging for Windows (.nsis), Mac (.dmg), Linux (.AppImage, .deb)

## Project Structure

```
src/
  main/              # Electron main process (Node.js)
    db/
      schema.ts      # SQLite schema + migrations (table recreation for CHECK constraints)
      queries.ts     # All CRUD operations, folder export, DB import/export, API key encryption
    llm/
      client.ts      # OpenAI-compatible API client, always-streaming, tool call loop (unlimited rounds)
    mcp/
      manager.ts     # MCP server lifecycle, tool discovery, tool execution, config validation, minimal env
    index.ts         # Window management, IPC handlers, defaults, template vars, navigation guards
    preload.ts       # Context bridge (renderer ↔ main)
  renderer/          # Svelte frontend
    lib/
      components/
        ChatView.svelte      # Chat canvas, streaming, thinking traces, input bar with stats, context estimate
        ChatMessage.svelte   # Message bubble (user/assistant), tool_call card (blue), tool result card (green), thinking card (amber)
        Sidebar.svelte       # Left sidebar: folders (collapsible, renameable), conversations, streaming indicator, export/import
        RightSidebar.svelte  # Right panel: system prompt editor, sampling sliders, MCP config/tools
        Settings.svelte      # Modal: defaults, endpoints, system prompts, sampling presets, help page
        Toast.svelte         # Toast notification system (2s auto-dismiss)
      stores/
        app.svelte.ts  # All reactive state, loaders, toast system, MCP tool count
      markdown.ts      # Markdown renderer with copy button delegation (DOMPurify + data-copy attr)
    App.svelte         # Root layout: sidebars + chat + settings modal + toast
    main.ts            # Svelte mount entry point
    app.css            # Global styles, Tailwind theme, markdown/code prose, emoji @font-face
    globals.d.ts       # Window.api type declarations
    index.html         # HTML shell with CSP meta tag
  shared/
    types.ts           # All interfaces shared between main + renderer
build/
  icon.png             # App icon (512x512)
  icons/               # Platform-specific icon sizes
electron-builder.yml   # Packaging config for all platforms
```

## Commands

- `npm run dev` — start dev server with hot reload + Electron
- `npm run build` — production build (renderer + main + preload)
- `npm run check` — svelte type checking
- `npm run dist:linux` — package for Linux (.AppImage + .deb)
- `npm run dist:win` — package for Windows (.nsis + portable) — needs Wine on Linux, or build on Windows
- `npm run dist:mac` — package for macOS (.dmg)
- `npm run dist` — package for current platform

## Architecture

### IPC Flow
All data flows: renderer `window.api.*` → preload `ipcRenderer.invoke` → main `ipcMain.handle` → queries/llm/mcp

### Streaming
- Always streaming on all rounds (including tool call follow-ups)
- Per-request channels (`stream-{timestamp}`)
- Main sends chunks via `webContents.send(channelId, chunk)`
- Renderer subscribes via `window.api.onStreamChunk(channelId, cb)`
- `StreamChunk` types: `delta`, `done`, `error`, `tool_call`, `tool_result`, `interim_assistant`
- Streaming scoped to conversation ID — switching chats doesn't leak or abort
- Other chats remain interactive while one is streaming (per-conversation `isStreamingHere` guard)
- Sidebar shows pulsing dot + "Generating..." on actively streaming conversations

### Database
- SQLite via better-sqlite3, lives in Electron `userData` directory
- Tables: `folders`, `endpoints`, `system_prompts`, `sampling_presets`, `conversations`, `messages`
- Message roles: `system`, `user`, `assistant`, `tool`, `tool_call` — tool traces stored as real messages for persistence
- Row mappers convert snake_case DB columns to camelCase TS types
- Schema migrations: `PRAGMA table_info` for column additions, table recreation for CHECK constraint updates (with `foreign_keys = OFF`)
- `conversations.last_stats` persists perf stats as JSON across restarts
- API keys encrypted at rest via Electron `safeStorage` with graceful plaintext fallback

### MCP
- Config stored in `userData/mcp.json`
- Servers spawned as stdio child processes via `@modelcontextprotocol/sdk`
- Servers connect BEFORE window loads so tools are ready on startup
- Minimal env for child processes (PATH, HOME, TEMP, LANG + explicit config env)
- Tools passed to LLM via OpenAI `tools` parameter only (no system prompt duplication)
- Tool call loop: unlimited rounds, streaming on all rounds
- Tool calls/results saved as messages (role `tool_call` / `tool`) for persistent inline display
- Config validated on save (command must be non-empty string, args must be array, env must be object)
- `mcpToolCount` in global store, shown as green dot in input bar

### Template Variables
- Resolved in system prompts at request time via `resolveTemplateVars()`
- `{{current_date}}` → ISO date (2026-03-30)
- `{{current_time}}` → locale time (3:45:12 PM)
- `{{current_datetime}}` → locale datetime
- Case-insensitive matching
- Applied in both the API request and the system prompt banner display

### State Management
- Single `appState` object in `app.svelte.ts` using Svelte 5 `$state` runes
- Data: endpoints, conversations, messages, folders, models, systemPrompts, samplingPresets, defaults
- UI: isStreaming, streamingContent, streamingConversationId, sidebarOpen, rightSidebarOpen, settingsOpen, promptProcessing
- Stats: lastStats, lastStatsConversationId, mcpToolCount
- Toasts: array with auto-dismiss
- `systemPromptVersion` counter triggers re-fetch of effective system prompt in ChatView
- Use `$derived(expression)` not `$derived(() => expression)` — the latter creates a function, not a value

### User Data (all in Electron `userData` directory)
- `ai-studio.db` — SQLite database (all conversations, messages, endpoints, presets, folders)
- `mcp.json` — MCP server config
- `defaults.json` — default endpoint, system prompt, sampling preset for new chats
- Export options: individual DB, full zip, folder conversations as JSON (OpenAI API format with multimodal vision support)

### Multi-turn History
- `user` and `assistant` messages sent directly
- `tool_call` and `tool` messages reconstructed into proper OpenAI format (assistant with `tool_calls` array + tool result messages)
- `<think>...</think>` tags stripped from assistant messages before sending to API
- Thinking traces preserved in DB and shown as collapsible amber cards

### Agent Mode
- Toggle in input bar — orange when active, shows step counter
- System prompt addendum injected via `agentAddendum` parameter (from `src/renderer/lib/agent.ts`)
- Auto-continue loop: after each response, sends transient "Continue" user message (not persisted to DB)
- `[DONE]` marker detection ends the loop with a toast notification
- Empty response handling: nudge prompt on first empty, stops after 3 consecutive empties
- Stop button aborts both current generation and agent loop

## Key Patterns

- Svelte 5 runes only: `$state`, `$derived`, `$effect`, `$props`, `{#snippet}`
- Tailwind v4: custom colors in `@theme {}`, use semantic names (`bg-bg-primary`, `text-text-muted`, `bg-bg-btn`)
- IPC channels: `{entity}:{action}` naming (e.g. `endpoints:list`, `messages:create`, `chat:send`)
- Toast feedback: call `showToast('message')` after every save/delete/apply action
- Buttons: accent (indigo) for primary actions, `bg-bg-btn` for secondary
- Sidebar toggles: hamburger (left) and gear (right) in toolbar, highlighted indigo (`bg-accent/10`) when panel open
- Keyboard: Ctrl+Enter to send, Escape to cancel edits
- Textarea auto-resizes up to ~12 lines, resets on send
- Auto-focus textarea on conversation switch
- Settings modal refreshes all store data on close
- Context estimate: chars/4 approximation, shown live in input bar

## Security

- `contextIsolation: true`, `nodeIntegration: false`
- CSP meta tag: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`
- Navigation guard: `will-navigate` blocks external URLs, opens them in system browser
- `setWindowOpenHandler` denies all new windows
- API keys encrypted at rest via `safeStorage.encryptString()` / `decryptString()`
- All SQL queries parameterized (zero string concatenation)
- DOMPurify on all markdown → HTML (with `ADD_ATTR: ['data-copy']`)
- MCP config schema validated before save
- MCP processes get minimal environment (not full `process.env`)

## Build Notes

- `postinstall` script runs `electron-rebuild -o better-sqlite3` to compile native module for Electron's Node version
- `archiver` and `@modelcontextprotocol/sdk` must be in vite external list for main process build
- Cross-compiling native modules (better-sqlite3) from Linux to Windows doesn't work — build on target platform or use CI
- Emoji rendering requires `fonts-noto-color-emoji` on Linux (installed separately), CSS uses `@font-face` with `unicode-range` to avoid spacing issues
- WSLg needs: `libgtk-3-0 libnss3 libatk-bridge2.0-0 libgbm1 libasound2t64 libnspr4` etc. for Electron
- Default sampling: temp=1.0, top_p=0.9, top_k=20, max_tokens=65536, repeat_penalty=1.1
- Default endpoint seeded on first run: `http://127.0.0.1:8000/v1`

## Known Limitations

- Windows builds from Linux need Wine for NSIS installer (unpacked folder works without Wine)
- Image paste from Windows clipboard to WSLg doesn't work (WSLg limitation, not app bug)
- `stream_options` removed for provider compatibility — token stats rely on client-side counting + provider usage data if available
- Context estimate is approximate (chars/4) — no tokenizer
