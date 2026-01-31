import { useState, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from './components/Layout/Sidebar';
import { MainChat } from './components/Chat/MainChat';
import { SettingsModal } from './components/Layout/SettingsModal';
import { getSession } from './lib/db';

import type { ChatSession, Message } from './lib/db';
import { exportChat, exportChats, importChats } from './lib/export-import';
import { streamCompletion } from './lib/llm';
import { useAppSettings } from './hooks/useAppSettings';
import { useChatHistory } from './hooks/useChatHistory';
import './App.css';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for the active chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Chat History Hook
  const {
    sessions,
    addSession,
    updateSession,
    removeSession,
    renameSession,
    toggleSessionFavorite,
    bulkDeleteSessions,
    importSessions
  } = useChatHistory();

  const [isLoading, setIsLoading] = useState(false);

  // Global Settings Hook
  const {
    apiUrl,
    modelName,
    defaultSystemPrompt,
    defaultTemperature,
    defaultReasoningEffort,
    availableModels,
    updateSettings,
    fetchModels,
    setModelName,
    serverEndpoints,
    streamingEnabled,
    setStreamingEnabled
  } = useAppSettings();

  // Active Chat Settings (initialized from defaults when new chat starts)
  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt);
  const [temperature, setTemperature] = useState(defaultTemperature);
  const [reasoningEffort, setReasoningEffort] = useState(defaultReasoningEffort);

  // Sync active chat settings when defaults change (only if we are NOT in an active chat? 
  // Or should we trust the initial state setter?
  // React useState initial value is only used on first render. 
  // So we need effects to update these if the defaults load async)

  // Actually, we need to handle the async load.
  // The hook does the loading. But the component renders immediately.
  // We can add a "settingsLoaded" flag to the hook, or just use an effect here to sync provided specific conditions are met.

  // Simple approach: When defaults change, updating the "New Chat" values is fine. 
  // But updating current state variables might overwrite user intent if they are editing them for a NEW chat.
  // However, since `systemPrompt` is just state, let's keep it simple.

  useEffect(() => {
    // If we are effectively in a "reset" state (no chat ID), sync with defaults
    if (!currentChatId) {
      setSystemPrompt(defaultSystemPrompt);
      setTemperature(defaultTemperature);
      setReasoningEffort(defaultReasoningEffort);
    }
  }, [defaultSystemPrompt, defaultTemperature, defaultReasoningEffort, currentChatId]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);


  // ... (handleNewChat and handleSelectChat remain unchanged, skipping for brevity but assuming they are preserved if I use StartLine/EndLine correctly) ...
  // Actually, I can't skip comfortably with replace_file_content unless I target specific blocks.
  // I will target the Connection Settings block first, then the handleSendMessage block, then the SettingsModal block.
  // Wait, I should do this in chunks to be safe with the tool.

  // Chunk 1: State initialization
  // Chunk 2: handleSendMessage update
  // Chunk 3: SettingsModal update

  // Let's do that.

  const handleNewChat = async () => {
    if (isLoading) return; // Prevent switching while generating

    // If we were in a chat, save its final state to sessions AND persistence
    if (currentChatId) {
      const sessionToSave = sessions.find(s => s.id === currentChatId);
      if (sessionToSave) {
        const updatedSession = { ...sessionToSave, messages: messages, systemPrompt, temperature, reasoningEffort };
        await updateSession(updatedSession);
      }
    }

    // Reset view
    setCurrentChatId(null);
    setMessages([]);
    setSystemPrompt(defaultSystemPrompt);
    setTemperature(defaultTemperature);
    setReasoningEffort(defaultReasoningEffort);
  };

  const handleSelectChat = async (id: string) => {
    if (isLoading) return; // Prevent switching while generating

    // 1. Save current if open
    if (currentChatId) {
      const sessionToSave = sessions.find(s => s.id === currentChatId);
      if (sessionToSave) {
        const updatedSession = { ...sessionToSave, messages: messages, systemPrompt, temperature, reasoningEffort };
        await updateSession(updatedSession);
      }
    }

    // 2. Load new
    const target = sessions.find(s => s.id === id);
    if (target) {
      if (target.id === currentChatId) return;

      setCurrentChatId(id);
      setMessages(target.messages);
      setSystemPrompt(target.systemPrompt || defaultSystemPrompt);
      setTemperature(target.temperature ?? defaultTemperature);
      setReasoningEffort(target.reasoningEffort ?? defaultReasoningEffort);

      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const processGeneration = async (messagesToUse: Message[], sessionId: string, targetIndex?: number) => {
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    // Initialize assistant message if not targeting specific index
    if (targetIndex === undefined) {
      setMessages(prev => {
        targetIndex = prev.length;
        return [...prev, { role: 'assistant', content: '' }];
      });
    }

    // Since state updates are async, we need to trust the targetIndex is valid for the NEXT render cycle
    // We already queued the update above.

    await streamCompletion({
      apiUrl,
      modelName,
      messages: messagesToUse,
      systemPrompt,
      temperature,
      reasoningEffort,
      signal: abortControllerRef.current.signal,
      stream: streamingEnabled,
      onUpdate: (content, stats) => {
        setMessages(prev => {
          const next = [...prev];
          // Determine index if it was undefined initially (it would be prev.length - 1 if we just added it)
          // But effectively we captured `targetIndex` in closure.
          // The issue is `targetIndex` variable above was mutated in a callback which doesn't affect this scope?
          // Actually, let's fix the targetIndex logic.
          const actualIndex = targetIndex !== undefined ? targetIndex : prev.length - 1;

          if (next[actualIndex]) {
            const msg = next[actualIndex];
            msg.content = content;
            msg.stats = {
              totalTokens: stats.tokenCount,
              generationTime: stats.duration,
              tokensPerSecond: stats.tps
            };

            if (msg.siblings && msg.siblingIndex !== undefined) {
              msg.siblings[msg.siblingIndex] = {
                ...msg.siblings[msg.siblingIndex],
                content: content,
                stats: msg.stats
              };
            }
          }
          return next;
        });
      },
      onFinish: (content, stats) => {
        let finalMessages: Message[] = [];
        setMessages(prev => {
          const next = [...prev];
          const actualIndex = targetIndex !== undefined ? targetIndex : prev.length - 1;

          if (next[actualIndex]) {
            const msg = next[actualIndex];
            msg.content = content;
            msg.stats = {
              totalTokens: stats.tokenCount,
              generationTime: stats.duration,
              tokensPerSecond: stats.tps
            };
            if (msg.siblings && msg.siblingIndex !== undefined) {
              msg.siblings[msg.siblingIndex] = {
                ...msg.siblings[msg.siblingIndex],
                content: content,
                stats: msg.stats
              };
            }
          }
          finalMessages = next;
          return next;
        });

        // Update session state via hook
        if (sessionId) {
          getSession(sessionId).then(freshSession => {
            if (freshSession) {
              const updated = { ...freshSession, messages: finalMessages };
              updateSession(updated);
            }
          });
        }
        setIsLoading(false);
        abortControllerRef.current = null;
      },
      onError: (error) => {
        if (error.name === 'AbortError') {
          console.log('Generation stopped by user');
          return;
        }
        console.error("Chat Error:", error);
        const errorMsg: Message = {
          role: 'assistant',
          content: `**Error**: ${error.message}`
        };
        setMessages(prev => {
          const next = [...prev];
          const actualIndex = targetIndex !== undefined ? targetIndex : prev.length - 1;
          // If we were updating an existing one, replace/append error?
          // Actually simpler to just update the content if we can, or append if we failed instantly.
          if (targetIndex !== undefined && next[actualIndex]) {
            next[actualIndex] = errorMsg;
          } else {
            next.push(errorMsg);
          }
          return next;
        });
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    });
  };

  const handleSendMessage = async (content: string, images?: string[]) => {
    const userMsg: Message = { role: 'user', content, images };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages); // UI update

    // Initialize Session if New
    let activeSessionId = currentChatId;
    if (!activeSessionId) {
      activeSessionId = Date.now().toString();
      const newSession: ChatSession = {
        id: activeSessionId,
        title: content.trim().substring(0, 30) + (content.length > 30 ? "..." : ""),
        date: new Date(),
        messages: newMessages,
        systemPrompt,
        temperature,
        reasoningEffort
      };
      await addSession(newSession);
      setCurrentChatId(activeSessionId);
    } else {
      // Update existing
      const s = sessions.find(s => s.id === activeSessionId);
      if (s) {
        await updateSession({ ...s, messages: newMessages, systemPrompt, temperature, reasoningEffort });
      }
    }

    // Call Generation
    await processGeneration(newMessages, activeSessionId);
  };

  const handleRegenerate = async () => {
    if (isLoading || messages.length === 0) return;

    const lastMsgIndex = messages.length - 1;
    const lastMsg = messages[lastMsgIndex];

    if (lastMsg.role === 'assistant') {
      // Prepare siblings structure
      const updatedMsg = { ...lastMsg };

      // Ensure current content is saved in siblings
      if (!updatedMsg.siblings) {
        updatedMsg.siblings = [
          { role: lastMsg.role, content: lastMsg.content, stats: lastMsg.stats }
        ];
        updatedMsg.siblingIndex = 0;
      }

      // Add new empty sibling
      const newSibling = { role: 'assistant', content: '', stats: undefined } as Message;
      updatedMsg.siblings = [...(updatedMsg.siblings || []), newSibling];
      updatedMsg.siblingIndex = updatedMsg.siblings.length - 1;
      updatedMsg.content = ''; // Reset main content for streaming
      updatedMsg.stats = undefined;

      // Update state before generation
      const newMessages = [...messages];
      newMessages[lastMsgIndex] = updatedMsg;
      setMessages(newMessages);

      // Context is everything BEFORE this message
      const context = messages.slice(0, -1);

      if (currentChatId) {
        // Target the EXISTING index (lastMsgIndex)
        processGeneration(context, currentChatId, lastMsgIndex);
      }
    } else if (lastMsg.role === 'user') {
      // Just standard generation
      if (currentChatId) {
        processGeneration(messages, currentChatId);
      }
    }
  };

  const handleVersionChange = (index: number, newVersionIndex: number) => {
    const msg = messages[index];
    if (!msg.siblings || !msg.siblings[newVersionIndex]) return;

    const targetVersion = msg.siblings[newVersionIndex];
    const updatedMsg = {
      ...msg,
      content: targetVersion.content,
      stats: targetVersion.stats,
      siblingIndex: newVersionIndex
    };

    const newMessages = [...messages];
    newMessages[index] = updatedMsg;
    setMessages(newMessages);

    // Persist
    if (currentChatId) {
      const s = sessions.find(ss => ss.id === currentChatId);
      if (s) {
        const updatedSession = { ...s, messages: newMessages };
        updateSession(updatedSession);
      }
    }
  };

  const handleDeleteChat = async (id: string) => {
    await removeSession(id);

    // 3. If deleted chat was active, switch to new chat state
    if (currentChatId === id) {
      setCurrentChatId(null);
      setMessages([]);
      setSystemPrompt(defaultSystemPrompt);
      setTemperature(defaultTemperature);
      setReasoningEffort(defaultReasoningEffort);
    }
  };

  const handleDeleteMessage = async (index: number) => {
    const updatedMessages = messages.filter((_, i) => i !== index);
    setMessages(updatedMessages);

    if (currentChatId) {
      const session = sessions.find(s => s.id === currentChatId);
      if (session) {
        // Use updateSession from hook, simpler than manual save
        updateSession({ ...session, messages: updatedMessages });
      }
    }
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    renameSession(id, newTitle);
  };

  const handleToggleFavorite = async (id: string) => {
    toggleSessionFavorite(id);
  };

  const handleExportChat = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      exportChat(session);
    }
  };

  // Bulk Actions
  const handleExportSelectedChats = (ids: string[]) => {
    const selectedSessions = sessions.filter(s => ids.includes(s.id));
    if (selectedSessions.length > 0) {
      exportChats(selectedSessions);
    }
  };

  const handleDeleteSelectedChats = async (ids: string[]) => {
    await bulkDeleteSessions(ids);
    // 3. If current chat was deleted, reset
    if (currentChatId && ids.includes(currentChatId)) {
      setMessages([]);
      setCurrentChatId(null);
      setSystemPrompt(defaultSystemPrompt);
      setTemperature(defaultTemperature);
      setReasoningEffort(defaultReasoningEffort);
    }
  };

  const handleExportAllChats = () => {
    exportChats(sessions);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedSessions = await importChats(file);
      let switchId = null;

      // Handle remapping
      const processedImports = importedSessions.map(importedSession => {
        if (sessions.some(s => s.id === importedSession.id)) {
          return {
            ...importedSession,
            id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: importedSession.title + " (Imported)"
          };
        }
        return importedSession;
      });

      await importSessions(processedImports);

      if (processedImports.length === 1) {
        switchId = processedImports[0].id;
        handleSelectChat(switchId);
      } else if (processedImports.length > 1) {
        alert(`Successfully imported ${processedImports.length} chats.`);
      }

      // Clear input
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err) {
      console.error("Import failed", err);
      alert("Failed to import chat: " + (err as Error).message);
    }
  };

  const contextTokens = useMemo(() => {
    return messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0) + Math.ceil((systemPrompt || '').length / 4);
  }, [messages, systemPrompt]);

  return (
    <div className="app-container">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenSettings={() => setIsSettingsOpen(true)}

        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onToggleFavorite={handleToggleFavorite}
        onExportChat={handleExportChat}
        onImportChat={() => fileInputRef.current?.click()}
        onExportAllChats={handleExportAllChats}
        onExportSelectedChats={handleExportSelectedChats}
        onDeleteSelectedChats={handleDeleteSelectedChats}

        selectedChatId={currentChatId}
        chatHistory={sessions}
        isLoading={isLoading}
      />
      <div className="main-content">
        <MainChat
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          chatId={currentChatId}
          onStop={handleStop}
          onRegenerate={handleRegenerate}
          onVersionChange={handleVersionChange}
          contextTokens={contextTokens}
          onDeleteMessage={handleDeleteMessage}
          selectedModel={modelName}
          availableModels={availableModels}
          onRefreshModels={fetchModels}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          onModelSelect={(newModel) => {
            setModelName(newModel);
            // Updating model changes the global setting, we might want to also update the current session preference?
            // The current `saveSettings` call in original code did ONLY global settings update.
            // But if we want per-chat model persistence (not currently in ChatSession interface?), we'd add it there.
            // Current implementation only has global model.
            updateSettings({ apiUrl, modelName: newModel, defaultSystemPrompt, defaultTemperature, defaultReasoningEffort, serverEndpoints });
          }}
          reasoningEffort={reasoningEffort}
          onReasoningEffortChange={async (val) => {
            setReasoningEffort(val);
            if (currentChatId) {
              const s = sessions.find(ss => ss.id === currentChatId);
              if (s) {
                await updateSession({ ...s, reasoningEffort: val });
              }
            }
          }}
          systemPrompt={systemPrompt}
          onSystemPromptChange={async (val) => {
            setSystemPrompt(val);
            if (currentChatId) {
              const s = sessions.find(ss => ss.id === currentChatId);
              if (s) {
                await updateSession({ ...s, systemPrompt: val });
              }
            }
          }}
          temperature={temperature}
          onTemperatureChange={async (val) => {
            setTemperature(val);
            if (currentChatId) {
              const s = sessions.find(ss => ss.id === currentChatId);
              if (s) {
                await updateSession({ ...s, temperature: val });
              }
            }
          }}
          availableServers={serverEndpoints}
          currentServerUrl={apiUrl}
          onServerSelect={(newServerUrl) => {
            updateSettings({ apiUrl: newServerUrl });
          }}
          streamingEnabled={streamingEnabled}
          onStreamingToggle={(enabled) => {
            setStreamingEnabled(enabled);
            updateSettings({ streamingEnabled: enabled });
          }}
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentApiUrl={apiUrl}
        currentModel={modelName}
        currentSystemPrompt={defaultSystemPrompt}
        currentTemperature={defaultTemperature}
        currentReasoningEffort={defaultReasoningEffort}
        currentStreamingEnabled={streamingEnabled}
        savedServers={serverEndpoints}
        onSave={async (url, model, sysPrompt, temp, effort, servers, streaming) => {
          await updateSettings({
            apiUrl: url,
            modelName: model,
            defaultSystemPrompt: sysPrompt,
            defaultTemperature: temp,
            defaultReasoningEffort: effort,
            serverEndpoints: servers,
            streamingEnabled: streaming
          });

          // If no chat is active, update the current view to match the new defaults.
          if (!currentChatId) {
            setSystemPrompt(sysPrompt);
            setTemperature(temp);
            setReasoningEffort(effort);
          }
        }}
      />

      {/* Hidden File Input for Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".json"
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default App
