# Agent Understanding: AI Chat Client

This document provides a high-level overview of the project's architecture, state management, and core logic to assist AI agents in navigating and modifying the codebase.

## 1. Core Purpose
A frontend-only React application designed to interface with OpenAI-compatible APIs. It focuses on local LLM workflows, featuring persistent storage via IndexedDB, streaming responses, and support for multimodal (image) inputs and reasoning models.

## 2. Technical Architecture

### State Management & Orchestration
- **`src/App.tsx`**: The central hub. It orchestrates the relationship between the `Sidebar` (session management), `MainChat` (message rendering/input), and `SettingsModal` (configuration). It manages the "active" session state, current messages, and the loading states for LLM generation.
- **`src/hooks/useAppSettings.ts`**: Manages global configurations (API URL, default model, default system prompt, temperature, etc.). It persists these settings to IndexedDB.
- **`src/hooks/useChatHistory.ts`**: Manages the collection of chat sessions, allowing for creation, renaming, deletion, and favoriting.

### Data Persistence (IndexedDB)
- **`src/lib/db.ts`**: Defines the schema and provides an abstraction layer for IndexedDB using the `idb` library.
    - `sessions` store: Contains `ChatSession` objects (ID, title, date, messages, and per-chat settings).
    - `settings` store: Contains a single `AppSettings` object for global configuration.

### LLM Communication
- **`src/lib/llm.ts`**: Handles the actual `fetch` calls to the `/chat/completions` endpoint.
    - **Streaming**: Uses `ReadableStream` to parse Server-Sent Events (SSE).
    - **Reasoning Support**: Specifically looks for `reasoning_content` or `reasoning` fields in the delta and wraps them in `<think>` tags to facilitate UI rendering.
    - **Multimodal**: Maps user messages with images into the OpenAI-compatible content array format.

## 3. Key Data Models

### `Message`
```typescript
interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    images?: string[]; // Base64 or URL strings
    stats?: { // Generation metadata
        tokensPerSecond: number;
        totalTokens: number;
        generationTime: number;
    };
    siblings?: Message[]; // For versioning/regeneration
    siblingIndex?: number;
}
```

### `ChatSession`
```typescript
interface ChatSession {
    id: string;
    title: string;
    date: Date;
    messages: Message[];
    isFavorite?: boolean;
    systemPrompt?: string;
    temperature?: number;
    reasoningEffort?: 'low' | 'medium' | 'high';
}
```

## 4. Development Workflow & Patterns

### Component Pattern
The app uses a standard React component pattern with CSS modules. Components in `src/components/Chat` focus on the conversation flow, while `src/components/Layout` manages the application shell.

### Handling "Regeneration" (Siblings)
When a user regenerates a response, the app doesn't just replace the message; it implements a "siblings" system. The current assistant message is moved into a `siblings` array, and a new empty message is appended, allowing users to toggle between different versions of the same response.

### Implementation Notes for Agents
- **Adding new features**: Most new features involving data will require updates to `src/lib/db.ts` (schema) and potentially `src/hooks/`.
- **UI Changes**: Components are tightly coupled with `App.tsx` state via props.
- **API Compatibility**: Always ensure that any changes to the request payload in `src/lib/llm.ts` maintain OpenAI compatibility.
- **Async Operations**: Most database and network operations are asynchronous. Ensure proper error handling and loading states are maintained in the UI.
