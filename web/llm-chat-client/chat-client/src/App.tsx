import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Layout/Sidebar';
import { MainChat } from './components/Chat/MainChat';
import { SettingsModal } from './components/Layout/SettingsModal';
import { saveSession, getSessions, deleteSession, getSession, saveSettings, getSettings } from './lib/db';
import type { ChatSession, Message } from './lib/db';
import './App.css';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // State for the active chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // State for all history
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  // Connection Settings
  const [apiUrl, setApiUrl] = useState('http://192.168.1.29:8000/v1');
  const [modelName, setModelName] = useState('Qwen3-4B-Thinking-2507');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
  const [temperature, setTemperature] = useState(0.7);

  // Load history and settings on mount
  useEffect(() => {
    const loadData = async () => {
      const [loadedSessions, loadedSettings] = await Promise.all([
        getSessions(),
        getSettings()
      ]);
      setSessions(loadedSessions);
      if (loadedSettings) {
        setApiUrl(loadedSettings.apiUrl);
        setModelName(loadedSettings.modelName);
        setSystemPrompt(loadedSettings.systemPrompt);
        setTemperature(loadedSettings.temperature);
      }
    };
    loadData();
  }, []);

  // Save session whenever it updates (debounced ideally, but straightforward for now)
  // We'll hook into key update points instead of partial effects to be safer

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
        const updatedSession = { ...sessionToSave, messages: messages };

        // Update local state
        setSessions(prev => prev.map(s =>
          s.id === currentChatId ? updatedSession : s
        ));

        // Persist
        await saveSession(updatedSession);
      }
    }

    // Reset view
    setCurrentChatId(null);
    setMessages([]);
  };

  const handleSelectChat = async (id: string) => {
    if (isLoading) return; // Prevent switching while generating

    // 1. Save current if open
    if (currentChatId) {
      const sessionToSave = sessions.find(s => s.id === currentChatId);
      if (sessionToSave) {
        const updatedSession = { ...sessionToSave, messages: messages };

        // Update local
        setSessions(prev => prev.map(s =>
          s.id === currentChatId ? updatedSession : s
        ));

        // Persist
        await saveSession(updatedSession);
      }
    }

    // 2. Load new
    const target = sessions.find(s => s.id === id);
    if (target) {
      if (target.id === currentChatId) return;

      setCurrentChatId(id);
      setMessages(target.messages);

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

  const processGeneration = async (messagesToUse: Message[], sessionId: string) => {
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const endpoint = `${apiUrl.replace(/\/$/, '')}/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer none'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...messagesToUse
          ].map(({ role, content }) => ({ role, content })),
          temperature: temperature,
          stream: true
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is null");

      // Initialize empty assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      const startTime = Date.now();
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data: ')) continue;

          const dataStr = trimmedLine.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices[0]?.delta?.content || '';

            if (delta) {
              accumulatedContent += delta;
              tokenCount++;

              const currentTime = Date.now();
              const duration = (currentTime - startTime) / 1000;
              const tps = duration > 0 ? tokenCount / duration : 0;

              setMessages(prev => {
                const next = [...prev];
                const lastMsg = next[next.length - 1];
                if (lastMsg.role === 'assistant') {
                  lastMsg.content = accumulatedContent;
                  lastMsg.stats = {
                    totalTokens: tokenCount,
                    generationTime: duration,
                    tokensPerSecond: tps
                  };
                }
                return next;
              });
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e);
          }
        }
      }

      // Generation Complete
      abortControllerRef.current = null;

      const finalMsg: Message = {
        role: 'assistant',
        content: accumulatedContent,
        stats: {
          totalTokens: tokenCount,
          generationTime: (Date.now() - startTime) / 1000,
          tokensPerSecond: tokenCount / ((Date.now() - startTime) / 1000)
        }
      };

      const finalMessages = [...messagesToUse, finalMsg];

      // Update local session state
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: finalMessages } : s
      ));

      // Persist final message state
      if (sessionId) {
        try {
          const freshSession = await getSession(sessionId);
          if (freshSession) {
            const updated = { ...freshSession, messages: finalMessages };
            await saveSession(updated);
          } else {
            // Fallback logic
          }
        } catch (e) { console.error("Failed to save final", e); }
      }

      // (Removed Title Generation block)

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation stopped by user');
        return;
      }
      console.error("Chat Error:", error);
      const errorMsg: Message = {
        role: 'assistant',
        content: `**Error**: ${(error as Error).message}`
      };
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && !last.content) next[next.length - 1] = errorMsg;
        else next.push(errorMsg);
        return next;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (content: string) => {
    const userMsg: Message = { role: 'user', content };
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
        messages: newMessages
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentChatId(activeSessionId);
      await saveSession(newSession);
    } else {
      // Update existing
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId ? { ...s, messages: newMessages } : s
      ));
      const s = sessions.find(s => s.id === activeSessionId);
      if (s) await saveSession({ ...s, messages: newMessages });
    }

    // Call Generation
    await processGeneration(newMessages, activeSessionId);
  };

  const handleRegenerate = async () => {
    if (isLoading || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];

    // If the last message IS from assistant, we remove it and re-run conversation up to that point
    if (lastMsg.role === 'assistant') {
      const historyToKeep = messages.slice(0, -1);
      setMessages(historyToKeep);

      if (currentChatId) {
        processGeneration(historyToKeep, currentChatId);
      }
    }
    // If last matches user (e.g. error condition where AI didn't reply), we just re-run
    else if (lastMsg.role === 'user') {
      if (currentChatId) {
        processGeneration(messages, currentChatId);
      }
    }
  };

  const handleDeleteChat = async (id: string) => {
    // 1. Remove from DB
    // Assuming deleteSession is imported from './lib/db'
    // import { saveSession, getSessions, deleteSession } from './lib/db';
    await deleteSession(id);

    // 2. Remove from local state
    setSessions(prev => prev.filter(s => s.id !== id));

    // 3. If deleted chat was active, switch to new chat state
    if (currentChatId === id) {
      setCurrentChatId(null);
      setMessages([]);
    }
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    const session = await getSession(id);
    if (session) {
      await saveSession({ ...session, title: newTitle });
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        selectedChatId={currentChatId}
        chatHistory={sessions}
        isLoading={isLoading}
      />
      <div className="main-content">
        {!isSidebarOpen && (
          <button className="mobile-toggle" onClick={toggleSidebar}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
          </button>
        )}
        <MainChat
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          chatId={currentChatId}
          onStop={handleStop}
          onRegenerate={handleRegenerate}
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentApiUrl={apiUrl}
        currentModel={modelName}
        currentSystemPrompt={systemPrompt}
        currentTemperature={temperature}
        onSave={async (url, model, sysPrompt, temp) => {
          setApiUrl(url);
          setModelName(model);
          setSystemPrompt(sysPrompt);
          setTemperature(temp);
          await saveSettings({
            apiUrl: url,
            modelName: model,
            systemPrompt: sysPrompt,
            temperature: temp
          });
        }}
      />
    </div>
  )
}

export default App
