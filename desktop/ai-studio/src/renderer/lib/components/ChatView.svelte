<script lang="ts">
  import { appState, loadMessages, loadModels, loadConversations } from '../stores/app.svelte';
  import ChatMessage from './ChatMessage.svelte';
  import { renderMarkdown } from '../markdown';
  import type { Conversation, MessageAttachment } from '../../../shared/types';

  let userInput = $state('');
  let messagesContainer: HTMLDivElement;
  let fileInput: HTMLInputElement;
  let textareaEl: HTMLTextAreaElement;
  let activeChannelId = $state<string | null>(null);
  let userAtBottom = $state(true);
  let showScrollIndicator = $derived(isStreamingHere && !userAtBottom);
  let pendingImages = $state<MessageAttachment[]>([]);
  let draggingOver = $state(false);
  let toolActivity = $state<{ name: string; status: 'calling' | 'done'; arguments?: string; result?: string }[]>([]);
  let effectiveSystemPrompt = $state<string | null>(null);
  let systemPromptOpen = $state(false);
  let thinkingOpen = $state(false);
  let toolCardsOpen = $state<Record<number, boolean>>({});

  const activeConv = $derived(
    appState.conversations.find((c) => c.id === appState.activeConversationId)
  );

  const isStreamingHere = $derived(
    appState.isStreaming && appState.streamingConversationId === appState.activeConversationId
  );

  // Load effective system prompt when conversation changes or prompt is edited
  $effect(() => {
    // Track both conversation id and version to re-fetch on edits
    const _convId = appState.activeConversationId;
    const _version = appState.systemPromptVersion;
    if (_convId) {
      window.api.getEffectiveSystemPrompt(_convId).then((p) => {
        effectiveSystemPrompt = p;
      });
    } else {
      effectiveSystemPrompt = null;
    }
  });

  // Parse thinking traces from streaming content
  // Models may wrap thinking in <think>...</think> tags
  const parsedStreaming = $derived(() => {
    const raw = appState.streamingContent;
    if (!raw) return { thinking: '', content: '' };

    const thinkMatch = raw.match(/^<think>([\s\S]*?)(<\/think>)?([\s\S]*)$/);
    if (thinkMatch) {
      const thinking = thinkMatch[1] ?? '';
      const closed = !!thinkMatch[2];
      const content = closed ? (thinkMatch[3] ?? '') : '';
      return { thinking: thinking.trim(), content: content.trim() };
    }
    return { thinking: '', content: raw };
  });

  const streamingThinking = $derived(parsedStreaming().thinking);
  const streamingContent = $derived(parsedStreaming().content);
  const streamingHtmlContent = $derived(streamingContent ? renderMarkdown(streamingContent) : '');

  // Focus textarea when switching conversations
  $effect(() => {
    if (appState.activeConversationId && textareaEl) {
      requestAnimationFrame(() => textareaEl?.focus());
    }
  });

  function isNearBottom(): boolean {
    if (!messagesContainer) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    return scrollHeight - scrollTop - clientHeight < 80;
  }

  function scrollToBottom() {
    if (messagesContainer) {
      requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        userAtBottom = true;
      });
    }
  }

  function handleScroll() {
    userAtBottom = isNearBottom();
  }

  $effect(() => {
    if (appState.messages.length || appState.streamingContent) {
      if (userAtBottom) {
        scrollToBottom();
      }
    }
  });

  async function sendMessage() {
    const hasText = userInput.trim().length > 0;
    const hasImages = pendingImages.length > 0;
    if ((!hasText && !hasImages) || !appState.activeConversationId || isStreamingHere) return;

    const content = userInput.trim();
    userInput = '';
    if (textareaEl) textareaEl.style.height = '';
    const attachments = pendingImages.length > 0 ? JSON.stringify(pendingImages) : undefined;
    pendingImages = [];

    await window.api.createMessage(appState.activeConversationId, 'user', content || '(image)', attachments);
    await loadMessages(appState.activeConversationId);

    if (appState.messages.length === 1) {
      const title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
      await window.api.updateConversation(appState.activeConversationId, { title });
      await loadConversations();
    }

    await streamResponse();
  }

  async function streamResponse() {
    if (!appState.activeConversationId) return;

    const streamConvId = appState.activeConversationId;
    appState.isStreaming = true;
    appState.streamingContent = '';
    appState.streamingConversationId = streamConvId;

    const channelId = `stream-${Date.now()}`;
    activeChannelId = channelId;
    let fullContent = '';
    let finished = false;
    let tokenCount = 0;
    let firstTokenTime = 0;
    const streamStartTime = Date.now();

    appState.lastStats = { promptTokens: 0, completionTokens: 0, totalTokens: 0, tokensPerSecond: 0, generationTimeMs: 0 };
    appState.promptProcessing = true;
    appState.promptProcessingStartTime = streamStartTime;
    toolActivity = [];
    thinkingOpen = false;
    toolCardsOpen = {};

    const cleanup = (content: string) => {
      if (finished) return;
      finished = true;
      appState.promptProcessing = false;
      activeChannelId = null;
      unsubscribe();
      finishStream(content, streamConvId!);
    };

    const unsubscribe = window.api.onStreamChunk(channelId, (chunk) => {
      if (chunk.type === 'delta' && chunk.content) {
        fullContent += chunk.content;
        appState.streamingContent = fullContent;
        tokenCount++;
        if (!firstTokenTime) {
          firstTokenTime = Date.now();
          appState.promptProcessing = false;
        }
        const elapsed = Date.now() - firstTokenTime;
        appState.lastStats = {
          promptTokens: 0,
          completionTokens: tokenCount,
          totalTokens: tokenCount,
          tokensPerSecond: elapsed > 0 ? Math.round((tokenCount / elapsed) * 10000) / 10 : 0,
          generationTimeMs: Date.now() - streamStartTime,
        };
      } else if (chunk.type === 'done') {
        const ttftMs = firstTokenTime ? firstTokenTime - streamStartTime : Date.now() - streamStartTime;
        if (chunk.stats) {
          const elapsed = firstTokenTime ? Date.now() - firstTokenTime : 1;
          const completionTokens = chunk.stats.completionTokens || tokenCount;
          appState.lastStats = {
            ...chunk.stats,
            completionTokens,
            tokensPerSecond: elapsed > 0 ? Math.round((completionTokens / elapsed) * 10000) / 10 : 0,
            generationTimeMs: Date.now() - streamStartTime,
            ttftMs,
          };
        } else {
          appState.lastStats = { ...appState.lastStats!, ttftMs };
        }
        cleanup(fullContent);
      } else if (chunk.type === 'tool_call' && chunk.toolCall) {
        toolActivity = [...toolActivity, { name: chunk.toolCall.name, status: 'calling', arguments: chunk.toolCall.arguments }];
      } else if (chunk.type === 'tool_result' && chunk.toolResult) {
        toolActivity = toolActivity.map((t) =>
          t.name === chunk.toolResult!.name && t.status === 'calling'
            ? { ...t, status: 'done' as const, result: chunk.toolResult!.result }
            : t
        );
      } else if (chunk.type === 'error') {
        cleanup(`Error: ${chunk.error}`);
      }
    });

    try {
      await window.api.sendChat(appState.activeConversationId, channelId);
    } catch (err: any) {
      cleanup(`Error: ${err.message}`);
    }
  }

  async function finishStream(content: string, conversationId: string) {
    try {
      if (conversationId && content) {
        await window.api.createMessage(conversationId, 'assistant', content);
        // Only refresh messages if we're still viewing that conversation
        if (appState.activeConversationId === conversationId) {
          await loadMessages(conversationId);
        }
      }
    } finally {
      appState.isStreaming = false;
      appState.streamingContent = '';
      appState.streamingConversationId = null;
    }
  }

  async function handleEdit(messageId: string, newContent: string) {
    if (!appState.activeConversationId) return;
    const msg = appState.messages.find((m) => m.id === messageId);
    if (!msg) return;
    await window.api.updateMessage(messageId, newContent);
    await window.api.deleteMessagesAfter(appState.activeConversationId, msg.createdAt);
    await loadMessages(appState.activeConversationId);
    await streamResponse();
  }

  async function handleRegenerate() {
    if (!appState.activeConversationId) return;
    const lastMsg = appState.messages[appState.messages.length - 1];
    if (lastMsg?.role === 'assistant') {
      await window.api.deleteMessage(lastMsg.id);
      await loadMessages(appState.activeConversationId);
    }
    await streamResponse();
  }

  async function stopResponse() {
    if (activeChannelId) {
      await window.api.abortChat(activeChannelId);
    }
  }

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, 288) + 'px';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage();
    }
  }

  function fileToAttachment(file: File): Promise<MessageAttachment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ type: 'image', mimeType: file.type, base64 });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function addImageFiles(files: FileList | File[]) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const att = await fileToAttachment(file);
      pendingImages = [...pendingImages, att];
    }
  }

  function removeImage(index: number) {
    pendingImages = pendingImages.filter((_, i) => i !== index);
  }

  async function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      await addImageFiles(imageFiles);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    draggingOver = true;
  }

  function handleDragLeave() {
    draggingOver = false;
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    draggingOver = false;
    if (e.dataTransfer?.files) {
      await addImageFiles(Array.from(e.dataTransfer.files));
    }
  }

  function openFilePicker() {
    fileInput?.click();
  }

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      await addImageFiles(Array.from(input.files));
      input.value = '';
    }
  }

  async function updateEndpoint(e: Event) {
    if (!activeConv) return;
    const endpointId = (e.target as HTMLSelectElement).value;
    await window.api.updateConversation(activeConv.id, { endpointId });
    await loadConversations();
    await loadModels(endpointId);
    if (appState.models.length > 0) {
      await window.api.updateConversation(activeConv.id, { modelId: appState.models[0].id });
      await loadConversations();
    }
  }

  async function updateModel(e: Event) {
    if (!activeConv) return;
    const modelId = (e.target as HTMLSelectElement).value;
    await window.api.updateConversation(activeConv.id, { modelId });
    await loadConversations();
  }

  async function updateSystemPrompt(e: Event) {
    if (!activeConv) return;
    const val = (e.target as HTMLSelectElement).value;
    await window.api.updateConversation(activeConv.id, { systemPromptId: val || undefined });
    await loadConversations();
  }

  async function updateSamplingPreset(e: Event) {
    if (!activeConv) return;
    const val = (e.target as HTMLSelectElement).value;
    await window.api.updateConversation(activeConv.id, { samplingPresetId: val || undefined });
    await loadConversations();
  }

  $effect(() => {
    if (activeConv?.endpointId) {
      loadModels(activeConv.endpointId);
    }
  });
</script>

<div class="flex flex-col h-full">
  {#if !appState.activeConversationId}
    <!-- Empty state -->
    <div class="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-secondary">
      <button
        onclick={() => appState.sidebarOpen = !appState.sidebarOpen}
        class="p-2 rounded-lg transition-colors cursor-pointer {appState.sidebarOpen ? 'text-accent bg-accent/10' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'}"
        title="{appState.sidebarOpen ? 'Hide' : 'Show'} sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>
      </button>
      <button
        onclick={() => appState.rightSidebarOpen = !appState.rightSidebarOpen}
        class="p-2 rounded-lg transition-colors cursor-pointer {appState.rightSidebarOpen ? 'text-accent bg-accent/10' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'}"
        title="{appState.rightSidebarOpen ? 'Hide' : 'Show'} configuration"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center text-text-muted">
        <div class="text-3xl font-light mb-3">AI Studio</div>
        <div class="text-sm">Select a conversation or create a new one to get started.</div>
        {#if appState.endpoints.length === 0}
          <div class="mt-4 text-accent text-sm">
            No endpoints configured. Open Settings to add one.
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-secondary">
      <!-- Left: sidebar toggle -->
      <button
        onclick={() => appState.sidebarOpen = !appState.sidebarOpen}
        class="p-2 rounded-lg transition-colors cursor-pointer flex-shrink-0 {appState.sidebarOpen ? 'text-accent bg-accent/10' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'}"
        title="{appState.sidebarOpen ? 'Hide' : 'Show'} sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>
      </button>

      <!-- Center: dropdowns -->
      <div class="flex-1 flex items-center gap-2 flex-wrap min-w-0">
        <select
          value={activeConv?.endpointId ?? ''}
          onchange={updateEndpoint}
          class="bg-bg-input border border-border rounded-lg px-3 py-1.5 text-text-primary text-sm cursor-pointer"
        >
          {#each appState.endpoints as ep (ep.id)}
            <option value={ep.id}>{ep.name}</option>
          {/each}
        </select>

        <select
          value={activeConv?.modelId ?? ''}
          onchange={updateModel}
          class="bg-bg-input border border-border rounded-lg px-3 py-1.5 text-text-primary text-sm cursor-pointer"
        >
          {#each appState.models as model (model.id)}
            <option value={model.id}>{model.name}</option>
          {/each}
        </select>

        <select
          value={activeConv?.systemPromptId ?? ''}
          onchange={updateSystemPrompt}
          class="bg-bg-input border border-border rounded-lg px-3 py-1.5 text-text-primary text-sm cursor-pointer"
        >
          <option value="">No system prompt</option>
          {#each appState.systemPrompts as sp (sp.id)}
            <option value={sp.id}>{sp.name}</option>
          {/each}
        </select>

        <select
          value={activeConv?.samplingPresetId ?? ''}
          onchange={updateSamplingPreset}
          class="bg-bg-input border border-border rounded-lg px-3 py-1.5 text-text-primary text-sm cursor-pointer"
        >
          <option value="">Default sampling</option>
          {#each appState.samplingPresets as preset (preset.id)}
            <option value={preset.id}>{preset.name}</option>
          {/each}
        </select>
      </div>

      <!-- Right: config toggle -->
      <button
        onclick={() => appState.rightSidebarOpen = !appState.rightSidebarOpen}
        class="p-2 rounded-lg transition-colors cursor-pointer flex-shrink-0 {appState.rightSidebarOpen ? 'text-accent bg-accent/10' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'}"
        title="{appState.rightSidebarOpen ? 'Hide' : 'Show'} configuration"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>

    <!-- Messages -->
    <div bind:this={messagesContainer} class="flex-1 overflow-y-auto px-6 py-8 relative" onscroll={handleScroll}>
      <div class="max-w-3xl mx-auto">

        <!-- System prompt banner -->
        {#if effectiveSystemPrompt}
          <div class="mb-6 border border-border rounded-xl overflow-hidden bg-bg-secondary">
            <button
              onclick={() => systemPromptOpen = !systemPromptOpen}
              class="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-bg-tertiary transition-colors"
            >
              <span class="text-xs font-bold uppercase tracking-wider text-violet-600 bg-violet-100 px-2 py-0.5 rounded">System</span>
              <span class="text-sm text-text-secondary flex-1 truncate">
                {effectiveSystemPrompt.slice(0, 80)}{effectiveSystemPrompt.length > 80 ? '...' : ''}
              </span>
              <span class="text-text-muted text-xs flex-shrink-0">{systemPromptOpen ? '▾' : '▸'}</span>
            </button>
            {#if systemPromptOpen}
              <div class="px-4 pb-4 border-t border-border">
                <pre class="text-sm text-text-secondary whitespace-pre-wrap mt-3 max-h-[300px] overflow-y-auto leading-relaxed">{effectiveSystemPrompt}</pre>
              </div>
            {/if}
          </div>
        {/if}

        {#each appState.messages as msg, i (msg.id)}
          <ChatMessage
            message={msg}
            isLast={i === appState.messages.length - 1}
            isStreaming={isStreamingHere}
            onEdit={handleEdit}
            onRegenerate={handleRegenerate}
          />
        {/each}

        <!-- Thinking trace (from <think> tags) -->
        {#if isStreamingHere && streamingThinking}
          <div class="mb-4 border border-amber-200 bg-amber-50 rounded-xl overflow-hidden">
            <button
              onclick={() => thinkingOpen = !thinkingOpen}
              class="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-amber-100 transition-colors"
            >
              <span class="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-200 px-2 py-0.5 rounded flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Thinking
              </span>
              <span class="text-sm text-amber-800/70 flex-1 truncate">
                {streamingThinking.slice(0, 60)}{streamingThinking.length > 60 ? '...' : ''}
              </span>
              <span class="text-amber-600 text-xs flex-shrink-0">{thinkingOpen ? '▾' : '▸'}</span>
            </button>
            {#if thinkingOpen}
              <div class="px-4 pb-4 border-t border-amber-200">
                <pre class="text-sm text-amber-900/80 whitespace-pre-wrap mt-3 max-h-[200px] overflow-y-auto leading-relaxed">{streamingThinking}</pre>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Tool call cards (only during streaming) -->
        {#if toolActivity.length > 0 && isStreamingHere}
          <div class="mb-4 space-y-2">
            {#each toolActivity as tool, idx}
              <div class="border rounded-xl overflow-hidden {tool.status === 'calling' ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'}">
                <button
                  onclick={() => toolCardsOpen = { ...toolCardsOpen, [idx]: !toolCardsOpen[idx] }}
                  class="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors {tool.status === 'calling' ? 'hover:bg-blue-100' : 'hover:bg-emerald-100'}"
                >
                  {#if tool.status === 'calling'}
                    <span class="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-200 px-2 py-0.5 rounded flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                      Tool Call
                    </span>
                  {:else}
                    <span class="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-200 px-2 py-0.5 rounded flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Tool Done
                    </span>
                  {/if}
                  <span class="text-sm font-mono font-medium {tool.status === 'calling' ? 'text-blue-900' : 'text-emerald-900'}">{tool.name}</span>
                  <span class="{tool.status === 'calling' ? 'text-blue-600' : 'text-emerald-600'} text-xs ml-auto flex-shrink-0">{toolCardsOpen[idx] ? '▾' : '▸'}</span>
                </button>
                {#if toolCardsOpen[idx]}
                  <div class="px-4 pb-4 border-t {tool.status === 'calling' ? 'border-blue-200' : 'border-emerald-200'} space-y-3">
                    {#if tool.arguments}
                      <div class="mt-3">
                        <div class="text-xs font-medium uppercase tracking-wider {tool.status === 'calling' ? 'text-blue-600' : 'text-emerald-600'} mb-1">Arguments</div>
                        <pre class="text-sm bg-white/60 rounded-lg p-3 overflow-x-auto font-mono {tool.status === 'calling' ? 'text-blue-900/80' : 'text-emerald-900/80'}">{(() => { try { return JSON.stringify(JSON.parse(tool.arguments!), null, 2); } catch { return tool.arguments; } })()}</pre>
                      </div>
                    {/if}
                    {#if tool.result}
                      <div>
                        <div class="text-xs font-medium uppercase tracking-wider text-emerald-600 mb-1">Result</div>
                        <pre class="text-sm bg-white/60 rounded-lg p-3 overflow-x-auto max-h-[200px] overflow-y-auto text-emerald-900/80 whitespace-pre-wrap">{tool.result}</pre>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <!-- Streaming message (after thinking/tools) -->
        {#if isStreamingHere && streamingContent}
          <div class="flex justify-start mb-5">
            <div class="max-w-[80%] bg-assistant-bubble rounded-2xl rounded-bl-sm px-5 py-4">
              <div class="text-xs text-text-muted mb-1.5 font-medium uppercase tracking-wide">Assistant</div>
              <div class="text-[15px] leading-relaxed prose-md">{@html streamingHtmlContent}</div>
            </div>
          </div>
        {/if}

        <!-- Waiting indicator (no thinking, no tools, no content yet) -->
        {#if isStreamingHere && appState.promptProcessing}
          <div class="flex justify-start mb-5">
            <div class="bg-assistant-bubble rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-3">
              <div class="flex gap-1">
                <span class="w-2 h-2 rounded-full bg-accent animate-bounce" style="animation-delay: 0ms"></span>
                <span class="w-2 h-2 rounded-full bg-accent animate-bounce" style="animation-delay: 150ms"></span>
                <span class="w-2 h-2 rounded-full bg-accent animate-bounce" style="animation-delay: 300ms"></span>
              </div>
              <span class="text-sm text-text-muted">Processing prompt...</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Scroll-to-bottom indicator -->
      {#if showScrollIndicator}
        <button
          onclick={scrollToBottom}
          class="sticky bottom-4 left-1/2 -translate-x-1/2 bg-accent hover:bg-accent-hover text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg cursor-pointer transition-opacity z-10 text-sm"
        >
          ↓
        </button>
      {/if}
    </div>

    <!-- Input area -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="border-t border-border bg-bg-secondary px-6 py-4 {draggingOver ? 'ring-2 ring-accent ring-inset' : ''}"
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
    >
      <input
        bind:this={fileInput}
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        onchange={handleFileSelect}
      />

      <div class="max-w-3xl mx-auto">
        <!-- Image carousel -->
        {#if pendingImages.length > 0}
          <div class="flex gap-3 mb-3 overflow-x-auto pb-1">
            {#each pendingImages as img, i}
              <div class="relative flex-shrink-0 group">
                <img
                  src="data:{img.mimeType};base64,{img.base64}"
                  alt="Pending attachment"
                  class="h-20 w-20 object-cover rounded-lg border border-border"
                />
                <button
                  onclick={() => removeImage(i)}
                  class="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  ✕
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Drag overlay hint -->
        {#if draggingOver}
          <div class="text-center text-accent text-sm py-3 mb-3">Drop images here</div>
        {/if}

        <!-- Textarea -->
        <textarea
          bind:this={textareaEl}
          bind:value={userInput}
          placeholder="Type a message... (Ctrl+Enter to send)"
          class="w-full bg-bg-input border border-border rounded-xl px-4 py-3 text-[15px] text-text-primary resize-none min-h-[72px] focus:outline-none focus:border-accent cursor-text overflow-y-auto"
          style="max-height: 288px"
          rows="2"
          oninput={autoResize}
          onkeydown={handleKeydown}
          onpaste={handlePaste}
          disabled={isStreamingHere}
        ></textarea>

        <!-- Bottom bar: left = attach + indicators, right = stats + send -->
        <div class="flex items-center justify-between mt-2">
          <!-- Left: attach + MCP indicator -->
          <div class="flex items-center gap-3">
            <button
              onclick={openFilePicker}
              disabled={isStreamingHere}
              class="px-3 py-1.5 rounded-lg bg-bg-btn hover:bg-bg-btn-hover border border-border text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
              title="Attach images"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              Attach
            </button>

            {#if appState.mcpToolCount > 0}
              <div class="flex items-center gap-1.5 text-xs text-text-muted" title="{appState.mcpToolCount} MCP tools available">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>MCP ({appState.mcpToolCount})</span>
              </div>
            {/if}

            {#if pendingImages.length > 0}
              <span class="text-xs text-text-muted">{pendingImages.length} image{pendingImages.length > 1 ? 's' : ''}</span>
            {/if}
          </div>

          <!-- Right: stats + send/stop -->
          <div class="flex items-center gap-4">
            <!-- Perf stats -->
            {#if appState.lastStats}
              <div class="flex gap-3 text-xs text-text-muted">
                <span>{appState.lastStats.tokensPerSecond} tok/s</span>
                <span>{appState.lastStats.completionTokens} gen</span>
                <span>{appState.lastStats.promptTokens} prompt</span>
                {#if appState.lastStats.ttftMs !== undefined}
                  <span>TTFT {appState.lastStats.ttftMs < 1000 ? `${appState.lastStats.ttftMs}ms` : `${(appState.lastStats.ttftMs / 1000).toFixed(1)}s`}</span>
                {/if}
                <span>{(appState.lastStats.generationTimeMs / 1000).toFixed(1)}s</span>
              </div>
            {/if}

            {#if isStreamingHere}
              <button
                onclick={stopResponse}
                class="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
                title="Stop generating"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                Stop
              </button>
            {:else}
              <button
                onclick={sendMessage}
                disabled={!userInput.trim() && pendingImages.length === 0}
                class="px-4 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
                title="Send message (Ctrl+Enter)"
              >
                Send
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
