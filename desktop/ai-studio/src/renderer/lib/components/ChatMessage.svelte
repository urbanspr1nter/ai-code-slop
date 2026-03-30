<script lang="ts">
  import type { Message } from '../../../shared/types';
  import { renderMarkdown } from '../markdown';

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

  function startEdit() {
    editContent = message.content;
    editing = true;
  }

  function saveEdit() {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    editing = false;
  }

  function cancelEdit() {
    editing = false;
  }

  const isUser = $derived(message.role === 'user');

  // Parse thinking traces from saved assistant messages
  const parsed = $derived(() => {
    if (isUser) return { thinking: '', content: message.content };
    const raw = message.content;
    const thinkMatch = raw.match(/^<think>([\s\S]*?)<\/think>\s*([\s\S]*)$/);
    if (thinkMatch) {
      return { thinking: thinkMatch[1].trim(), content: thinkMatch[2].trim() };
    }
    return { thinking: '', content: raw };
  });

  const thinkingContent = $derived(parsed().thinking);
  const displayContent = $derived(parsed().content);
  const renderedContent = $derived(
    isUser ? '' : renderMarkdown(displayContent)
  );
</script>

<div class="mb-5 group">
  <!-- Thinking trace (collapsed by default for saved messages) -->
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
