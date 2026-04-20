import React, { useState, useEffect, useRef } from "react";
import { Send, Search, LogOut, User, Smile, Image as ImageIcon, CheckCheck, Copy, Users, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  auth, 
  db, 
  signInAnonymously, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  setDoc, 
  getDoc,
  limit,
  Timestamp,
} from "./firebase";

// --- Types ---
interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: any;
  type: string;
}

interface ChatUser {
  id: string;
  handle: string;
  name: string;
  avatarColor: string;
  isOnline: boolean;
  lastSeen: number;
}

const avatarColors = [
  "#6366F1", "#EC4899", "#F59E0B", "#10B981", "#8B5CF6", "#3B82F6", "#EF4444"
];

export default function App() {
  // Auth & Identity
  const [user, setUser] = useState<any>(null);
  const [myHandle, setMyHandle] = useState<string | null>(localStorage.getItem("echochat_handle"));
  const [myName, setMyName] = useState<string | null>(localStorage.getItem("echochat_username"));
  
  // UI States
  const [activeTab, setActiveTab] = useState<"chats" | "users">("chats");
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [searchHandle, setSearchHandle] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  
  // Login Flow
  const [inputHandle, setInputHandle] = useState("");
  const [inputName, setInputName] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Chat Data
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- 1. Authentication & Presence ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        signInAnonymously(auth).catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && myHandle) {
      const userRef = doc(db, "users", myHandle);
      const updatePresence = () => {
        setDoc(userRef, { 
          isOnline: document.visibilityState === 'visible',
          lastSeen: Date.now() 
        }, { merge: true });
      };
      
      updatePresence();
      document.addEventListener("visibilitychange", updatePresence);
      return () => {
        document.removeEventListener("visibilitychange", updatePresence);
        setDoc(userRef, { isOnline: false, lastSeen: Date.now() }, { merge: true });
      };
    }
  }, [user, myHandle]);

  // --- 2. Data Synchronization ---
  // Fetch All Users (Discovery)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users"), orderBy("lastSeen", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatUser));
      setAllUsers(list);
    }, (error) => {
      console.error("Users list sync error:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Private Messages
  useEffect(() => {
    if (!user || !myHandle || !selectedUser) {
      setMessages([]);
      return;
    }

    const convId = [myHandle, selectedUser.handle].sort().join("_");
    const q = query(
      collection(db, "conversations", convId, "messages"),
      orderBy("timestamp", "asc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
    }, (error) => {
      console.error("Messages sync error:", error);
      if (error.message.includes("permissions")) {
        setAuthError("Database access denied. Check your Firestore Security Rules.");
      }
    });

    return () => unsubscribe();
  }, [user, myHandle, selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- 3. Handlers ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const handle = inputHandle.trim().toLowerCase();
    const name = inputName.trim();

    if (!handle || !name) {
      setAuthError("Please fill in both fields");
      return;
    }

    if (!/^[a-z0-9_]{3,15}$/.test(handle)) {
      setAuthError("ID must be 3-15 chars (letters, numbers, underscores only)");
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const userRef = doc(db, "users", handle);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setAuthError("This ID is already taken. Try another one!");
        setIsAuthLoading(false);
        return;
      }

      const color = avatarColors[Math.floor(Math.random() * avatarColors.length)];
      await setDoc(userRef, {
        id: user?.uid || "",
        handle,
        name,
        avatarColor: color,
        isOnline: true,
        lastSeen: Date.now()
      });

      localStorage.setItem("echochat_handle", handle);
      localStorage.setItem("echochat_username", name);
      localStorage.setItem("echochat_color", color);
      
      setMyHandle(handle);
      setMyName(name);
      
      const hasSeen = localStorage.getItem("echochat_seen_letter");
      if (hasSeen !== "true") {
        setShowLetter(true);
      }
    } catch (err: any) {
      setAuthError(err.message || "Registration failed");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || !myHandle || !selectedUser) return;

    const text = message.trim();
    setMessage("");
    const convId = [myHandle, selectedUser.handle].sort().join("_");

    try {
      await addDoc(collection(db, "conversations", convId, "messages"), {
        senderId: myHandle,
        senderName: myName,
        senderColor: localStorage.getItem("echochat_color") || "#6366F1",
        text,
        timestamp: serverTimestamp(),
        type: "text"
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const findUserByHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = searchHandle.trim().toLowerCase();
    if (!target || target === myHandle) return;

    const userRef = doc(db, "users", target);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      setSelectedUser(snap.data() as ChatUser);
      setSearchHandle("");
    } else {
      alert("User not found!");
    }
  };

  const copyMyId = () => {
    if (myHandle) {
      navigator.clipboard.writeText(myHandle);
      alert("ID copied! Share it with friends.");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };

  const getInitials = (n: string) => n.split(" ").map(x => x[0]).join("").toUpperCase().substring(0, 2);

  // --- 4. Render Logic ---
  if (!myHandle || !myName) {
    return (
      <div className="login-overlay">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="login-card p-8">
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl rotate-3">
              <MessageSquare size={40} />
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Create Identity</h2>
              <p className="text-gray-500 mt-2">Pick a permanent unique handle</p>
            </div>
            
            <form onSubmit={handleRegister} className="w-full space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-indigo-600 uppercase ml-2">Unique ID (Forever)</label>
                <input
                  type="text"
                  value={inputHandle}
                  onChange={(e) => setInputHandle(e.target.value)}
                  placeholder="e.g. kavidu_99"
                  className="search-input py-4 text-center lowercase font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Display Name</label>
                <input
                  type="text"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  placeholder="Your Name"
                  className="search-input py-4 text-center"
                />
              </div>

              {authError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 text-center">{authError}</div>}

              <button 
                type="submit" 
                disabled={isAuthLoading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50"
              >
                {isAuthLoading ? "Registering..." : "Join EchoChat"}
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
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="letter-card bg-[#fffcf5] border-2 border-pink-100 shadow-2xl">
              <div className="text-pink-400 mb-4 flex justify-center"><Smile size={48} /></div>
              <div className="letter-text text-[#c18c8c] leading-relaxed font-medium">
                manika mn oya wenuwen me lokema unth anith patta harawnn puluwn hrida mn oyt godk adreyi kisim kellek ta mehm adryk lbnne nha sudu mn pna wge adreyi hmdma math ekka inna 🥺
              </div>
              <button 
                onClick={() => { localStorage.setItem("echochat_seen_letter", "true"); setShowLetter(false); }}
                className="mt-8 w-full py-3 bg-pink-400 text-white rounded-full font-bold shadow-lg hover:bg-pink-500 transition-colors"
              >
                I Promise
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <aside className={`sidebar flex flex-col ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="flex items-center gap-3">
             <div className="avatar bg-indigo-600 text-white">{getInitials(myName || "")}</div>
             <div className="flex flex-col">
                <span className="font-bold text-sm text-gray-900">{myName}</span>
                <span className="text-[10px] text-gray-400">@{myHandle}</span>
             </div>
          </div>
          <div className="flex gap-1 ml-auto">
             <button onClick={copyMyId} className="p-2 hover:bg-indigo-50 rounded-full text-indigo-600 transition-colors" title="Copy My ID">
                <Copy size={18} />
             </button>
             <button onClick={handleLogout} className="p-2 hover:bg-red-50 rounded-full text-red-400 transition-colors" title="Logout">
                <LogOut size={18} />
             </button>
          </div>
        </div>

        <div className="px-4 pb-4">
           <form onSubmit={findUserByHandle} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input 
                type="text" 
                value={searchHandle}
                onChange={(e) => setSearchHandle(e.target.value)}
                placeholder="Find by ID (e.g. kavidu)" 
                className="search-input pl-10 h-10 text-xs" 
              />
           </form>
        </div>

        <div className="flex border-b border-gray-100 mb-2">
           <button onClick={() => setActiveTab('chats')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'chats' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}>
              <div className="flex items-center justify-center gap-2"><Send size={12} /> Chats</div>
           </button>
           <button onClick={() => setActiveTab('users')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'users' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}>
              <div className="flex items-center justify-center gap-2"><Users size={12} /> Explore</div>
           </button>
        </div>

        <div className="user-list">
          {activeTab === 'users' ? (
            allUsers.filter(u => u.handle !== myHandle).map(u => (
              <motion.div key={u.id} layout onClick={() => { setSelectedUser(u); setIsSidebarOpen(false); }} className="user-item">
                <div className="relative">
                  <div className="avatar" style={{ backgroundColor: u.avatarColor }}>{getInitials(u.name)}</div>
                  {u.isOnline && <div className="status-dot absolute bottom-0 right-0 border-2 border-white" />}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-gray-900">{u.name}</div>
                  <div className="text-[10px] text-gray-400">@{u.handle}</div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center p-8 opacity-40">
               <MessageSquare size={48} className="mb-4 text-indigo-200" />
               <p className="text-xs font-medium">Select a user to start chatting</p>
            </div>
          )}
        </div>
      </aside>

      <main className="chat-area">
        <header className="chat-header">
           <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-indigo-600"><Users size={24} /></button>
           {selectedUser ? (
             <div className="flex items-center gap-3">
                <div className="avatar w-10 h-10 ring-2 ring-indigo-50" style={{ backgroundColor: selectedUser.avatarColor }}>{getInitials(selectedUser.name)}</div>
                <div>
                   <div className="font-bold text-gray-900 leading-tight">{selectedUser.name}</div>
                   <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-tighter">@{selectedUser.handle}</div>
                </div>
             </div>
           ) : (
             <div className="font-bold text-gray-400 italic">Select a conversation</div>
           )}
        </header>

        <div className="messages-container">
          {selectedUser ? (
            <AnimatePresence mode="popLayout" initial={false}>
              {messages.map((msg) => (
                <motion.div key={msg.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col ${msg.senderId === myHandle ? 'items-end' : 'items-start'}`}>
                   <div className={`message ${msg.senderId === myHandle ? 'sent' : 'received'}`}>
                      <div className="leading-relaxed">{msg.text}</div>
                      <div className="text-[8px] opacity-50 mt-1 flex justify-end items-center gap-1">
                         {new Date(msg.timestamp?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         {msg.senderId === myHandle && <CheckCheck size={10} />}
                      </div>
                   </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </AnimatePresence>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-30">
               <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6"><MessageSquare size={40} className="text-indigo-300" /></div>
               <h3 className="text-xl font-black text-indigo-900 mb-2">Your Space</h3>
               <p className="max-w-xs text-sm">Find friends by their unique ID or explore the community to start private conversations.</p>
            </div>
          )}
        </div>

        {selectedUser && (
          <div className="input-area-wrapper p-4 bg-white/80 backdrop-blur-md">
            <form onSubmit={handleSendMessage} className="input-area max-w-4xl mx-auto flex gap-2">
               <div className="flex-1 bg-gray-50 rounded-2xl border border-gray-100 flex items-center px-4">
                  <textarea 
                    rows={1}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write a message..."
                    className="flex-1 bg-transparent py-3 text-sm focus:ring-0 border-none resize-none"
                    onKeyDown={(e) => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }}}
                  />
               </div>
               <button type="submit" disabled={!message.trim()} className="send-btn bg-indigo-600 shadow-indigo-100 shadow-xl disabled:bg-gray-100"><Send size={20} /></button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
