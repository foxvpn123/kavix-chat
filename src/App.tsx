import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Send, Search, Settings, MoreVertical, LogOut, User } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: string;
}

interface ChatUser {
  id: string;
  name: string;
  avatarColor: string;
}

export default function App() {
  const [userName, setUserName] = useState<string | null>(localStorage.getItem("echochat_username"));
  const [showLetter, setShowLetter] = useState(false);
  const [inputName, setInputName] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    if (userName) {
      newSocket.emit("join", userName);
    }

    newSocket.on("messageHistory", (history: Message[]) => {
      setMessages(history);
    });

    newSocket.on("message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    newSocket.on("userList", (userList: ChatUser[]) => {
      setUsers(userList);
    });

    return () => {
      newSocket.close();
    };
  }, [userName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      localStorage.setItem("echochat_username", inputName.trim());
      setUserName(inputName.trim());
      
      // Check if user has seen the letter
      const hasSeen = localStorage.getItem("echochat_seen_letter");
      if (!hasSeen) {
        setShowLetter(true);
      }
    }
  };

  const handleCloseLetter = () => {
    localStorage.setItem("echochat_seen_letter", "true");
    setShowLetter(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && socket) {
      socket.emit("sendMessage", message.trim());
      setMessage("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("echochat_username");
    setUserName(null);
    window.location.reload();
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
  };

  if (!userName) {
    return (
      <div className="login-overlay">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="login-card"
        >
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <User size={32} />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Welcome to EchoChat</h2>
              <p className="text-gray-500 mt-1">Enter your name to start chatting</p>
            </div>
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="What's your name?"
                className="search-input py-4 text-lg text-center"
                autoFocus
              />
              <button 
                type="submit" 
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
              >
                Let's Go
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <AnimatePresence>
        {showLetter && (
          <div className="letter-overlay">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="letter-card"
            >
              <div className="letter-text">
                manika mn oya wenuwen me lokema unth anith patta harawnn puluwn hrida mn oyt godk adreyi kisim kellek ta mehm adryk lbnne nha sudu mn pna wge adreyi hmdma math ekka inna 🥺
              </div>
              <button 
                onClick={handleCloseLetter}
                className="letter-btn"
              >
                I Promise
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="sidebar flex flex-col">
        <div className="sidebar-header">
          <div className="user-profile">
            <div className="avatar bg-indigo-600">
              {getInitials(userName)}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-gray-900 leading-tight">{userName}</span>
              <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Online</span>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
            <LogOut size={20} />
          </button>
        </div>

        <div className="search-box">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" className="search-input pl-10" placeholder="Search people..." />
          </div>
        </div>

        <div className="user-list">
          <div className="px-5 py-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Active Users ({users.length})</span>
          </div>
          <AnimatePresence mode="popLayout">
            {users.map((u) => (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={`user-item ${u.name === userName ? 'bg-indigo-50/50' : ''}`}
              >
                <div className="relative">
                  <div className="avatar" style={{ backgroundColor: u.avatarColor }}>
                    {getInitials(u.name)}
                  </div>
                  <div className="status-dot absolute bottom-0 right-0" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-900">{u.name} {u.name === userName && "(You)"}</div>
                  <div className="text-xs text-gray-500">Active now</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </aside>

      {/* Chat Area */}
      <main className="chat-area">
        <header className="chat-header">
          <div className="chat-header-info">
            <div className="avatar bg-indigo-600 w-10 h-10">
              EC
            </div>
            <div>
              <div className="font-bold text-gray-900">Echo Chat Room</div>
              <div className="typing-indicator">
                {users.length} members connected
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
              <Search size={20} />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
              <Settings size={20} />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </header>

        <div className="messages-container">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                layout
                className={`message ${msg.senderName === userName ? 'sent' : 'received'}`}
              >
                {msg.senderName !== userName && (
                  <div className="text-[10px] font-bold mb-1" style={{ color: msg.senderColor }}>
                    {msg.senderName}
                  </div>
                )}
                <div>{msg.text}</div>
                <span className="msg-meta text-right">{msg.timestamp}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="input-area">
          <input
            type="text"
            className="message-input"
            placeholder="Type your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit" disabled={!message.trim()} className="send-btn group disabled:opacity-50 transition-opacity">
            <Send className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" size={20} />
          </button>
        </form>
      </main>
    </div>
  );
}
