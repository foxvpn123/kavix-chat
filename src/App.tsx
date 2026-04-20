import React, { useState, useEffect, useRef } from "react";
import { Send, Search, LogOut, User, Smile, Image as ImageIcon, CheckCheck, Copy, Users, MessageSquare, ArrowLeft, Camera } from "lucide-react";
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
  where,
  increment,
  updateDoc,
  getDocFromServer
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
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen: number;
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastSender: string;
  updatedAt: any;
  unreadCounts: Record<string, number>;
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchHandle, setSearchHandle] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Login Flow
  const [inputHandle, setInputHandle] = useState("");
  const [inputName, setInputName] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [registrationTask, setRegistrationTask] = useState<string>("");
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(localStorage.getItem("echochat_avatar"));

  // Chat Data
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- 1. Authentication & Presence ---
  useEffect(() => {
    console.log("Firebase Auth initializing...");
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        console.log("Authenticated as:", u.uid);
        setUser(u);
      } else {
        console.log("No user session, signing in anonymously...");
        signInAnonymously(auth).catch(err => {
          console.error("Auth failed:", err);
          setAuthError("Failed to connect to Secure Server. Please check internet.");
        });
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
      const list = snapshot.docs.map(d => {
        const data = d.data();
        // Force id to be d.id (the handle) to avoid UID duplicates
        return { ...data, id: d.id } as ChatUser;
      });
      setAllUsers(list);
    }, (error) => {
      console.error("Users list sync error:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Conversations (Inbox)
  useEffect(() => {
    if (!user || !myHandle) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", myHandle),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => {
        const data = d.data();
        return { ...data, id: d.id } as Conversation;
      });
      setConversations(list);
    }, (error) => {
      console.error("Conversations sync error:", error);
    });

    return () => unsubscribe();
  }, [user, myHandle]);

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

  // Clear unread count when viewing a chat
  useEffect(() => {
    if (user && myHandle && selectedUser) {
      const convId = [myHandle, selectedUser.handle].sort().join("_");
      const convRef = doc(db, "conversations", convId);
      
      const clearUnread = async () => {
        try {
          const snap = await getDoc(convRef);
          if (snap.exists()) {
            const data = snap.data() as Conversation;
            if (data.unreadCounts?.[myHandle] > 0) {
              await updateDoc(convRef, {
                [`unreadCounts.${myHandle}`]: 0
              });
            }
          }
        } catch (e) {
          console.warn("Could not clear unread count:", e);
        }
      };
      clearUnread();
    }
  }, [selectedUser, myHandle, user]);

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
      setRegistrationTask("Connecting to IXO Network...");
      
      // Ensure we have an auth session, try to sign in if not
      if (!auth.currentUser) {
        console.log("No current user, initiating anonymous sign-in...");
        await signInAnonymously(auth);
        
        // Brief wait for state propagation
        let waitAttempts = 0;
        while (!auth.currentUser && waitAttempts < 5) {
          await new Promise(r => setTimeout(r, 500));
          waitAttempts++;
        }
      }

      const currentHandle = handle.toLowerCase().trim();
      console.log("Starting registration for:", currentHandle);
      const userRef = doc(db, "users", currentHandle);
      
      setRegistrationTask("Verifying Unique Handle...");
      // Using standard getDoc - Firebase will retry internally if network is shaky
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setAuthError("This ID is already taken. Try another one!");
        setIsAuthLoading(false);
        return;
      }

      setRegistrationTask("Creating your profile...");
      const color = avatarColors[Math.floor(Math.random() * avatarColors.length)];
      const profileData = {
        id: user?.uid || "guest_" + Math.random().toString(36).substr(2, 9),
        handle,
        name,
        avatarColor: color,
        isOnline: true,
        lastSeen: Date.now()
      };

      await setDoc(userRef, profileData);

      console.log("Registration successful!");
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
      console.error("CRITICAL REGISTRATION ERROR:", err);
      // Detailed error for debugging on phone - v1.0.8 simplified
      const errorMsg = err.code ? `[Code: ${err.code}] ${err.message}` : (err.message || "Connection error. Check signal.");
      setAuthError(errorMsg);
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
      // 1. Add Message
      await addDoc(collection(db, "conversations", convId, "messages"), {
        senderId: myHandle,
        senderName: myName,
        senderColor: localStorage.getItem("echochat_color") || "#6366F1",
        text,
        timestamp: serverTimestamp(),
        type: "text"
      });

      // 2. Update Conversation Summary
      const convRef = doc(db, "conversations", convId);
      await setDoc(convRef, {
        participants: [myHandle, selectedUser.handle],
        lastMessage: text,
        lastSender: myHandle,
        updatedAt: serverTimestamp(),
        [`unreadCounts.${selectedUser.handle}`]: increment(1)
      }, { merge: true });

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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && myHandle) {
      if (file.size > 200000) { // 200KB limit for base64 storage
        alert("Image is too large. Please use a smaller photo (max 200KB).");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const userRef = doc(db, "users", myHandle);
          await setDoc(userRef, { avatarUrl: base64 }, { merge: true });
          setMyAvatarUrl(base64);
          localStorage.setItem("echochat_avatar", base64);
          alert("Profile photo updated!");
        } catch (err) {
          console.error("Photo upload failed:", err);
        }
      };
      reader.readAsDataURL(file);
    }
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
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">IXO Identity</h2>
              <p className="text-gray-500 mt-2">Pick a permanent unique handle</p>
              <p className="text-[8px] text-gray-300 mt-1 uppercase tracking-widest">Build v1.0.8 Clean-BUILD</p>
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
                {isAuthLoading ? (registrationTask || "CONNECTING...") : "JOIN THE CHAT"}
              </button>

              {isAuthLoading && registrationTask && (
                <div className="flex flex-col items-center gap-2 mt-2">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] text-indigo-400 font-medium uppercase tracking-widest animate-pulse">
                    {registrationTask}
                  </p>
                </div>
              )}
            </form>
          </div>
        </motion.div>

        {isAuthLoading && (
          <button 
            onClick={() => window.location.reload()}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 text-gray-400 text-xs underline decoration-gray-300 underline-offset-4"
          >
            Taking too long? Try Refreshing
          </button>
        )}
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

      <aside className={`sidebar flex flex-col ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <div className="sidebar-header bg-[#f0f2f5] px-4 py-2 border-b border-gray-200">
          <div className="flex items-center gap-3">
             <div className="relative group">
                {myAvatarUrl ? (
                  <img src={myAvatarUrl} alt="Me" className="w-10 h-10 rounded-full object-cover ring-1 ring-gray-200" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white text-sm font-bold">
                    {getInitials(myName || "")}
                  </div>
                )}
                <label className="absolute inset-0 bg-black/20 rounded-full opacity-0 hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <Camera size={14} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
             </div>
             <div className="flex flex-col">
                <span className="font-semibold text-sm text-[#111b21]">{myName}</span>
                <span className="text-[11px] text-[#667781]">@{myHandle}</span>
             </div>
          </div>
          <div className="flex gap-2 text-[#54656f]">
             <button onClick={copyMyId} className="p-2 hover:bg-black/5 rounded-full" title="Copy ID">
                <Copy size={20} />
             </button>
             <button onClick={handleLogout} className="p-2 hover:bg-black/5 rounded-full" title="Logout">
                <LogOut size={20} />
             </button>
          </div>
        </div>

        <div className="bg-white p-2">
           <div className={`flex items-center gap-4 bg-[#f0f2f5] px-4 py-1.5 rounded-lg transition-all ${isSearching ? 'ring-1 ring-wa-teal' : ''}`}>
              <Search size={16} className={isSearching ? 'text-wa-teal' : 'text-[#54656f]'} />
              <form onSubmit={findUserByHandle} className="flex-1">
                <input 
                  type="text" 
                  value={searchHandle}
                  onFocus={() => setIsSearching(true)}
                  onBlur={() => setIsSearching(false)}
                  onChange={(e) => setSearchHandle(e.target.value)}
                  placeholder="Search or start new chat" 
                  className="w-full bg-transparent border-none text-[14px] py-1 placeholder:text-[#667781] focus:ring-0" 
                />
              </form>
           </div>
        </div>

        <div className="flex bg-white">
           <button onClick={() => setActiveTab('chats')} className={`flex-1 py-3 text-[13px] font-semibold transition-all border-b-[3px] ${activeTab === 'chats' ? 'text-wa-teal border-wa-teal' : 'text-[#667781] border-transparent hover:bg-gray-50'}`}>
              CHATS
           </button>
           <button onClick={() => setActiveTab('users')} className={`flex-1 py-3 text-[13px] font-semibold transition-all border-b-[3px] ${activeTab === 'users' ? 'text-wa-teal border-wa-teal' : 'text-[#667781] border-transparent hover:bg-gray-50'}`}>
              EXPLORE
           </button>
        </div>

        <div className="user-list">
          {activeTab === 'users' ? (
            allUsers.filter(u => u.handle !== myHandle).map(u => (
              <motion.div 
                key={u.handle} 
                layout 
                onClick={() => { setSelectedUser(u); setActiveTab('chats'); }} 
                className={`user-item ${selectedUser?.handle === u.handle ? 'active' : ''}`}
              >
                <div className="relative">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.name} className="avatar object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="avatar" style={{ backgroundColor: u.avatarColor }}>{getInitials(u.name)}</div>
                  )}
                  {u.isOnline && <div className="status-dot absolute bottom-0 right-0" />}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[16px] text-[#111b21]">{u.name}</div>
                  <div className="text-[13px] text-[#667781]">@{u.handle}</div>
                </div>
              </motion.div>
            ))
          ) : (
            conversations.length > 0 ? (
              conversations.map(conv => {
                const otherHandle = conv.participants.find(p => p !== myHandle);
                const otherUser = allUsers.find(u => u.handle === otherHandle);
                const unreadCount = conv.unreadCounts?.[myHandle || ""] || 0;
                
                if (!otherUser && !otherHandle) return null;

                return (
                  <motion.div 
                    key={conv.id} 
                    layout 
                    onClick={() => { 
                      if (otherUser) setSelectedUser(otherUser);
                      else if (otherHandle) {
                        const resolve = async () => {
                           const snap = await getDoc(doc(db, "users", otherHandle));
                           if (snap.exists()) setSelectedUser(snap.data() as ChatUser);
                        };
                        resolve();
                      }
                    }} 
                    className={`user-item ${selectedUser?.handle === otherHandle ? 'active' : ''}`}
                  >
                    <div className="relative">
                      {otherUser?.avatarUrl ? (
                        <img src={otherUser.avatarUrl} alt="User" className="avatar object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="avatar" style={{ backgroundColor: otherUser?.avatarColor || "#cbd5e1" }}>
                          {getInitials(otherUser?.name || otherHandle || "??")}
                        </div>
                      )}
                      {otherUser?.isOnline && <div className="status-dot absolute bottom-0 right-0" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <div className="font-semibold text-[16px] text-[#111b21] truncate pr-2">{otherUser?.name || otherHandle}</div>
                        {conv.updatedAt && (
                          <span className={`text-[12px] whitespace-nowrap mt-1 ${unreadCount > 0 ? 'text-[#1fa855] font-semibold' : 'text-[#667781]'}`}>
                            {new Date(conv.updatedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <p className={`text-[13px] truncate flex-1 ${unreadCount > 0 ? 'text-[#111b21] font-medium' : 'text-[#667781]'}`}>
                          {conv.lastSender === myHandle ? (
                            <span className="flex items-center gap-1">
                               <CheckCheck size={14} className="text-[#53bdeb] inline" /> {conv.lastMessage}
                            </span>
                          ) : conv.lastMessage}
                        </p>
                        {unreadCount > 0 && (
                          <span className="bg-[#25d366] text-white min-w-[20px] h-[20px] flex items-center justify-center rounded-full text-[11px] font-bold px-1 ml-2 shadow-sm">
                             {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center p-12 text-[#667781]">
                <MessageSquare size={54} className="mb-4 opacity-10" />
                <p className="text-sm">Tap on Explore to find friends and start chatting!</p>
              </div>
            )
          )}
          
          {activeTab === 'chats' && (
             <button 
               onClick={() => setActiveTab('users')}
               className="fixed bottom-20 right-6 md:absolute md:bottom-12 md:right-6 w-14 h-14 bg-wa-teal rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all z-20"
             >
                <MessageSquare size={24} />
             </button>
          )}
        </div>

        <div className="p-4 border-t border-gray-50 bg-gray-50/30">
          <div className="text-center text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">
            kavix coding
          </div>
        </div>
      </aside>

      <main className={`chat-area ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <header className="chat-header">
           <div className="flex items-center gap-1.5 min-w-0 flex-1">
             <button 
               onClick={() => setSelectedUser(null)} 
               className="md:hidden p-2 -ml-2 text-[#54656f] hover:bg-black/5 rounded-full"
             >
               <ArrowLeft size={20} />
             </button>
             
             {selectedUser && (
               <div className="flex items-center gap-3 min-w-0 flex-1">
                  {selectedUser.avatarUrl ? (
                    <img src={selectedUser.avatarUrl} alt="User" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: selectedUser.avatarColor }}>{getInitials(selectedUser.name)}</div>
                  )}
                  <div className="min-w-0">
                     <div className="font-semibold text-[#111b21] truncate">{selectedUser.name}</div>
                     <div className="text-[12px] text-[#667781] truncate">
                        {selectedUser.isOnline ? "online" : "last seen recently"}
                     </div>
                  </div>
               </div>
             )}
           </div>
           
            {!selectedUser && (
             <div className="hidden md:block font-bold text-wa-teal tracking-wider text-xl">IXO</div>
           )}
        </header>

        <div className="messages-container pb-24">
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
          <div className="input-area-wrapper">
            <button className="text-[#54656f] p-2 hover:bg-black/5 rounded-full"><Smile size={24} /></button>
            <form onSubmit={handleSendMessage} className="flex-1 flex gap-2 items-center">
               <textarea 
                 rows={1}
                 value={message}
                 onChange={(e) => setMessage(e.target.value)}
                 placeholder="Type a message"
                 className="flex-1"
                 onKeyDown={(e) => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }}}
               />
               <button type="submit" disabled={!message.trim()} className="send-btn">
                  <Send size={24} className={message.trim() ? 'text-wa-teal' : 'text-[#8696a0]'} />
               </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
