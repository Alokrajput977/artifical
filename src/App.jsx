import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// API Configuration
const API_BASE_URL = 'http://localhost:8000/api';

const App = () => {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Sort chats by updated_at (newest first)
  const sortChatsByDate = (chatsArray) => {
    return [...chatsArray].sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at);
      const dateB = new Date(b.updated_at || b.created_at);
      return dateB - dateA; // Newest first
    });
  };

  // API Functions
  const fetchChats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/chats`);
      if (!response.ok) throw new Error('Failed to fetch chats');
      const data = await response.json();
      const sortedChats = sortChatsByDate(data);
      setChats(sortedChats);
      if (sortedChats.length > 0 && !activeChatId) {
        setActiveChatId(sortedChats[0].id);
      } else if (sortedChats.length === 0) {
        await createNewChat();
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('Failed to connect to backend. Please make sure the server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = async () => {
    const newChatId = Date.now().toString();
    const welcomeMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: "🤖 Hello! I'm Nexus, your AI companion. How can I enhance your experience today?",
      timestamp: new Date().toISOString()
    };
    
    const newChat = {
      id: newChatId,
      name: 'New Conversation',
      messages: [welcomeMessage]
    };
    
    try {
      const response = await fetch(`${API_BASE_URL}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChat)
      });
      
      if (!response.ok) throw new Error('Failed to create chat');
      const savedChat = await response.json();
      // Add new chat to the beginning of the list (newest first)
      setChats(prev => [savedChat, ...prev]);
      setActiveChatId(savedChat.id);
    } catch (err) {
      console.error('Error creating chat:', err);
      setError('Failed to create new chat');
      // Fallback: add locally
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(newChatId);
    }
    
    if (isMobile) setIsSidebarOpen(false);
  };

  const deleteChat = async (chatId, e) => {
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      try {
        const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok && response.status !== 204) {
          throw new Error('Failed to delete chat');
        }
        
        // Remove chat from state
        const updatedChats = chats.filter(chat => chat.id !== chatId);
        setChats(updatedChats);
        
        // If we deleted the active chat, switch to another chat
        if (activeChatId === chatId) {
          if (updatedChats.length > 0) {
            setActiveChatId(updatedChats[0].id);
          } else {
            // Create a new chat if no chats left
            await createNewChat();
          }
        }
        
        console.log('Chat deleted successfully');
      } catch (err) {
        console.error('Error deleting chat:', err);
        setError('Failed to delete chat');
      }
    }
  };

  const addMessageToChat = async (chatId, message) => {
    try {
      const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      
      if (!response.ok) throw new Error('Failed to add message');
      const updatedChat = await response.json();
      
      setChats(prev => {
        // Update the chat in the list and resort
        const updatedChats = prev.map(chat =>
          chat.id === chatId ? updatedChat : chat
        );
        return sortChatsByDate(updatedChats);
      });
      
      return updatedChat;
    } catch (err) {
      console.error('Error adding message:', err);
      setError('Failed to save message');
      return null;
    }
  };

  // Check voice support
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setVoiceSupported(false);
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        setTimeout(() => {
          if (transcript.trim()) {
            sendMessageWithText(transcript);
          }
        }, 500);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    const loadVoices = () => {
      const voices = synthRef.current.getVoices();
      setAvailableVoices(voices);
      const femaleVoice = voices.find(voice => 
        voice.name.includes('Google UK English Female') ||
        voice.name.includes('Samantha') ||
        voice.name.includes('Microsoft Zira') ||
        voice.name.includes('Google US English Female') ||
        (voice.name.toLowerCase().includes('female') && voice.lang.includes('en'))
      );
      setSelectedVoice(femaleVoice || voices.find(voice => voice.lang.includes('en')));
    };

    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }

    // Load chats from backend
    fetchChats();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      synthRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth <= 768) {
        setIsSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeChatId, isTyping]);

  const activeChat = chats.find(chat => chat.id === activeChatId);

  const speakMessage = (text) => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.2;
    utterance.volume = 1;
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    synthRef.current.cancel();
    setIsSpeaking(false);
  };

  const startListening = () => {
    if (recognitionRef.current && voiceSupported) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error("Voice recognition error:", error);
        setIsListening(false);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const sendMessageWithText = async (textToSend) => {
    if (!textToSend.trim() || isTyping || !activeChat) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString()
    };

    // Add user message to chat
    await addMessageToChat(activeChatId, userMessage);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(async () => {
      const responses = [
        "🔧 Processing your request... I've analyzed the data and here's what I found:",
        "⚡ Great question! Let me compute the best answer for you:",
        "🤖 As an AI system, I'd love to help with that. Here's my response:",
        "✨ Interesting! Based on my neural networks, I recommend:",
        "💡 I've processed your query and here's my insight:"
      ];
      
      const aiResponse = `${responses[Math.floor(Math.random() * responses.length)]}\n\n${textToSend}`;
      
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };
      
      await addMessageToChat(activeChatId, aiMessage);
      setIsTyping(false);
      
      setTimeout(() => {
        speakMessage(aiResponse);
      }, 500);
    }, 1500);
  };

  const sendMessage = async () => {
    await sendMessageWithText(input);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading Nexus AI...</p>
      </div>
    );
  }

  return (
    <div className={`app ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {error && (
        <div className="error-toast">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      {isMobile && isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <span className="logo-text">Nexus AI</span>
              <span className="logo-badge">MongoDB Powered</span>
            </div>
          </div>
          <button className="new-chat-btn" onClick={createNewChat}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
            </svg>
            New Chat
          </button>
        </div>

        <div className="chat-history">
          <div className="history-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Conversations ({chats.length})</span>
          </div>
          <div className="chat-list">
            {chats.map(chat => (
              <div
                key={chat.id}
                className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveChatId(chat.id);
                  if (isMobile) setIsSidebarOpen(false);
                }}
              >
                <div className="chat-info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span className="chat-name">{chat.name}</span>
                </div>
                <button className="delete-chat-btn" onClick={(e) => deleteChat(chat.id, e)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="system-status">
            <div className="status-indicator">
              <div className="status-led"></div>
              <span>MongoDB Connected</span>
            </div>
            <div className="model-info">
              <span>Nexus v3.0 | Voice AI</span>
            </div>
          </div>
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {isDarkMode ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                </svg>
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <button className="menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="header-info">
            <h2>{activeChat?.name}</h2>
            <div className="header-badge">
              <span className="badge">🤖 AI-Powered</span>
              <span className="badge">🎤 Voice Ready</span>
              <span className="badge">💾 MongoDB</span>
              {isSpeaking && <span className="badge speaking">🔊 Speaking...</span>}
            </div>
          </div>
          {isSpeaking && (
            <button className="stop-speech-btn" onClick={stopSpeaking} title="Stop speaking">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="4" width="12" height="16" rx="1"/>
              </svg>
            </button>
          )}
        </header>

        <div className="chat-container">
          <div className="messages-area">
            {activeChat?.messages.map((message, idx) => {
              const showDate = idx === 0 || formatDate(message.timestamp) !== formatDate(activeChat.messages[idx - 1]?.timestamp);
              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="date-divider">
                      <span>{formatDate(message.timestamp)}</span>
                    </div>
                  )}
                  <div className={`message ${message.role}`}>
                    <div className="message-avatar">
                      {message.role === 'user' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                          <path d="M2 17L12 22L22 17"/>
                          <path d="M2 12L12 17L22 12"/>
                        </svg>
                      )}
                    </div>
                    <div className="message-content">
                      <div className="message-text">{message.content}</div>
                      <div className="message-time">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>{formatTime(message.timestamp)}</span>
                        {message.role === 'assistant' && (
                          <button 
                            className="speak-message-btn"
                            onClick={() => speakMessage(message.content)}
                            title="Read aloud"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {isTyping && (
              <div className="message assistant">
                <div className="message-avatar">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    <path d="M2 17L12 22L22 17"/>
                    <path d="M2 12L12 17L22 12"/>
                  </svg>
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <div className="input-container">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyPress={handleKeyPress}
                placeholder="Message Nexus AI... or click the mic to speak"
                rows={1}
                className="message-input"
              />
              {voiceSupported && (
                <button 
                  className={`voice-btn ${isListening ? 'listening' : ''}`}
                  onClick={isListening ? stopListening : startListening}
                  title={isListening ? "Stop listening" : "Start voice input"}
                >
                  {isListening ? (
                    <div className="pulse-ring">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="3" width="6" height="11" rx="1"/>
                        <path d="M5 10v1a7 7 0 0 0 14 0v-1"/>
                        <line x1="12" y1="19" x2="12" y2="21"/>
                      </svg>
                    </div>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="3" width="6" height="11" rx="1"/>
                      <path d="M5 10v1a7 7 0 0 0 14 0v-1"/>
                      <line x1="12" y1="19" x2="12" y2="21"/>
                    </svg>
                  )}
                </button>
              )}
              <button 
                className="send-btn" 
                onClick={sendMessage} 
                disabled={!input.trim() || isTyping}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="input-hint">
              <span>⏎ Enter to send</span>
              <span>⇧ Shift + Enter for new line</span>
              {voiceSupported && <span>🎤 Click mic to speak</span>}
              {selectedVoice && <span>🎙️ Female voice enabled</span>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;