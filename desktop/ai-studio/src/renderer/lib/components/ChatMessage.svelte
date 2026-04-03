<script lang="ts">
  import type { Message } from '../../../shared/types';
  import { renderMarkdown } from '../markdown';
  import { parseThinking } from '../thinking';

  interface Props {
    message: Message;
    isLast: boolean;
    isStreaming: boolean;
    onEdit: (id: string, content: string) => void;
    onRegenerate: () => void;
  }

  let { message, isLast, isStreaming, onEdit, onRegenerate }: Props = $props();
  let editing = $state(false);
  let editContent = $state('');
  let thinkingOpen = $state(false);
  let toolDetailOpen = $state(false);

  function startEdit() {
    editContent = message.content;
    editing = true;
  }

  function saveEdit() {
    if (editContent.trim()) {
      onEdit(message.id, editContent.trim());
    }
    editing = false;
  }

  function cancelEdit() {
    editing = false;
  }

  const isUser = $derived(message.role === 'user');
  const isToolCall = $derived(message.role === 'tool_call');
  const isToolResult = $derived(message.role === 'tool');
  let copied = $state(false);

  function copyMessage() {
    navigator.clipboard.writeText(message.content);
    copied = true;
    setTimeout(() => { copied = false; }, 1500);
  }

  // Parse thinking traces from saved assistant messages
  const parsed = $derived(message.role === 'assistant' ? parseThinking(message.content) : { thinking: '', content: message.content });
  const thinkingContent = $derived(parsed.thinking);
  const displayContent = $derived(parsed.content);
  const renderedContent = $derived(
    message.role === 'assistant' ? renderMarkdown(displayContent) : ''
  );

  // Pretty-print tool call arguments
  function prettyArgs(): string {
    if (!isToolCall) return '';
    try { return JSON.stringify(JSON.parse(message.content), null, 2); } catch { return message.content; }
  }
</script>

<!-- Tool call message -->
{#if isToolCall}
  <div class="mb-2 border border-blue-200 bg-blue-50 rounded-xl overflow-hidden">
    <button
      onclick={() => toolDetailOpen = !toolDetailOpen}
      class="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer hover:bg-blue-100 transition-colors"
    >
      <span class="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-200 px-2 py-0.5 rounded">Tool Call</span>
      <span class="text-sm font-mono font-medium text-blue-900">{message.toolCallName || 'unknown'}</span>
      <span class="text-blue-600 text-xs ml-auto flex-shrink-0">{toolDetailOpen ? '▾' : '▸'}</span>
    </button>
    {#if toolDetailOpen}
      <div class="px-4 pb-3 border-t border-blue-200">
        <div class="text-xs font-medium uppercase tracking-wider text-blue-600 mt-2 mb-1">Arguments</div>
        <pre class="text-sm bg-white/60 rounded-lg p-3 overflow-x-auto font-mono text-blue-900/80">{prettyArgs()}</pre>
      </div>
    {/if}
  </div>

<!-- Tool result message -->
{:else if isToolResult}
  <div class="mb-2 border border-emerald-200 bg-emerald-50 rounded-xl overflow-hidden">
    <button
      onclick={() => toolDetailOpen = !toolDetailOpen}
      class="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer hover:bg-emerald-100 transition-colors"
    >
      <span class="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-200 px-2 py-0.5 rounded flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        Tool Result
      </span>
      <span class="text-sm font-mono font-medium text-emerald-900">{message.toolCallName || 'unknown'}</span>
      <span class="text-emerald-600 text-xs ml-auto flex-shrink-0">{toolDetailOpen ? '▾' : '▸'}</span>
    </button>
    {#if toolDetailOpen}
      <div class="px-4 pb-3 border-t border-emerald-200">
        <div class="text-xs font-medium uppercase tracking-wider text-emerald-600 mt-2 mb-1">Result</div>
        <pre class="text-sm bg-white/60 rounded-lg p-3 overflow-x-auto max-h-[200px] overflow-y-auto text-emerald-900/80 whitespace-pre-wrap">{message.content}</pre>
      </div>
    {/if}
  </div>

<!-- Regular message (user / assistant) -->
{:else}
  <div class="mb-5 group">
    <!-- Thinking trace -->
    {#if thinkingContent}
      <div class="mb-2 border border-amber-200 bg-amber-50 rounded-xl overflow-hidden max-w-[80%]">
        <button
          onclick={() => thinkingOpen = !thinkingOpen}
          class="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer hover:bg-amber-100 transition-colors"
        >
          <span class="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-200 px-2 py-0.5 rounded">Thinking</span>
          <span class="text-sm text-amber-800/70 flex-1 truncate">
            {thinkingContent.slice(0, 60)}{thinkingContent.length > 60 ? '...' : ''}
          </span>
          <span class="text-amber-600 text-xs flex-shrink-0">{thinkingOpen ? '▾' : '▸'}</span>
        </button>
        {#if thinkingOpen}
          <div class="px-4 pb-3 border-t border-amber-200">
            <pre class="text-sm text-amber-900/80 whitespace-pre-wrap mt-2.5 max-h-[200px] overflow-y-auto leading-relaxed">{thinkingContent}</pre>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Message bubble -->
    <div class="flex {isUser ? 'justify-end' : 'justify-start'}">
      <div class="max-w-[80%] {isUser ? 'bg-user-bubble' : 'bg-assistant-bubble'} rounded-2xl px-5 py-4 {isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}">
        <!-- Role label -->
        <div class="text-xs text-text-muted mb-1.5 font-medium uppercase tracking-wide">
          {message.role === 'user' ? 'You' : 'Assistant'}
        </div>

        <!-- Content -->
        {#if editing}
          <textarea
            bind:value={editContent}
            class="w-full bg-bg-input border border-border rounded-lg p-3 text-sm text-text-primary resize-none min-h-[80px] cursor-text"
            onkeydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
          ></textarea>
          <div class="flex gap-3 mt-3">
            <button onclick={saveEdit} class="text-sm px-4 py-2 bg-accent rounded-lg text-white hover:bg-accent-hover cursor-pointer transition-colors">Save & Regenerate</button>
            <button onclick={cancelEdit} class="text-sm px-4 py-2 bg-bg-btn hover:bg-bg-btn-hover rounded-lg text-text-secondary hover:text-text-primary cursor-pointer transition-colors">Cancel</button>
          </div>
        {:else}
          <!-- Attachments -->
          {#if message.attachments?.length}
            <div class="flex gap-3 mb-3 flex-wrap">
              {#each message.attachments as att}
                {#if att.type === 'image'}
                  <img src="data:{att.mimeType};base64,{att.base64}" alt="attachment" class="max-w-[200px] max-h-[200px] rounded-lg" />
                {/if}
              {/each}
            </div>
          {/if}

          {#if isUser}
            <div class="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{message.content}</div>
          {:else}
            <div class="text-[15px] leading-relaxed prose-md">{@html renderedContent}</div>
          {/if}

          <!-- Actions -->
          <div class="flex gap-2 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick={copyMessage} class="text-text-muted hover:text-accent cursor-pointer transition-colors p-1 rounded hover:bg-bg-tertiary" title={copied ? 'Copied!' : 'Copy message'}>
              {#if copied}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              {:else}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              {/if}
            </button>
            {#if isUser}
              <button onclick={startEdit} class="text-text-muted hover:text-accent cursor-pointer transition-colors p-1 rounded hover:bg-bg-tertiary" title="Edit message">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </button>
            {/if}
            {#if isLast && message.role === 'assistant' && !isStreaming}
              <button onclick={onRegenerate} class="text-text-muted hover:text-accent cursor-pointer transition-colors p-1 rounded hover:bg-bg-tertiary" title="Regenerate response">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M21 21v-5h-5"/></svg>
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
