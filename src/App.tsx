import React, { useState, useEffect, useRef } from "react";
import { Send, Search, Settings, MoreVertical, LogOut, User, Smile, Image as ImageIcon, Check, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  auth, 
  db, 
  signInAnonymously, 
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged, 
  updateProfile,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  limit,
  Timestamp,
  deleteDoc
} from "./firebase";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: any;
  type: string;
  imageUrl?: string;
}

interface ChatUser {
  id: string;
  name: string;
  avatarColor: string;
  isOnline: boolean;
  lastSeen: number;
}

const avatarColors = [
  "#6366F1", "#EC4899", "#F59E0B", "#10B981", "#8B5CF6", "#3B82F6", "#EF4444"
];

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const [authResetCounter, setAuthResetCounter] = useState(0);
  const [userName, setUserName] = useState<string | null>(() => {
    try {
      // Defensive cleanup
      const keys = ["echochat_username", "echochat_color", "echochat_seen_letter"];
      keys.forEach(k => {
        const val = localStorage.getItem(k);
        if (val === "undefined" || val === "null" || val === null) {
          localStorage.removeItem(k);
        }
      });

      const saved = localStorage.getItem("echochat_username");
      if (saved && saved !== "undefined" && saved !== "null") {
        return saved;
      }
    } catch (e) {
      console.error("Local storage access failed", e);
    }
    return null;
  });
  const [showLetter, setShowLetter] = useState(false);
  const [inputName, setInputName] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [isTyping, setIsTyping] = useState<Record<string, string>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Core Auth Listener
  useEffect(() => {
    console.log("Setting up auth listener...");
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("Auth state changed:", u ? `User: ${u.uid}` : "No user");
      setUser(u);
      
      // If we find a user, clear any loading states
      if (u) {
        setIsGoogleLoading(false);
        setIsGuestLoading(false);
      }
    });

    return () => unsubscribe();
  }, [authResetCounter]);

  // 2. Username Resolver (Runs when user is detected but username is missing)
  useEffect(() => {
    if (user && !userName) {
      const savedName = localStorage.getItem("echochat_username");
      const effectiveName = user.displayName || savedName || `User_${user.uid.substring(0, 5)}`;
      
      console.log("Resolving username:", effectiveName);
      setUserName(effectiveName);
      
      if (!savedName) {
        localStorage.setItem("echochat_username", effectiveName);
      }
    }
  }, [user, userName]);

  // 3. Profile Synchronizer (Runs when both user and username are ready)
  useEffect(() => {
    if (user && userName) {
      const syncProfile = async () => {
        try {
          const userRef = doc(db, "users", user.uid);
          await setDoc(userRef, {
            id: user.uid,
            name: userName,
            lastSeen: Date.now(),
            isOnline: true,
            avatarColor: localStorage.getItem("echochat_color") || avatarColors[Math.floor(Math.random() * avatarColors.length)]
          }, { merge: true });
          console.log("Firestore profile synchronized");
        } catch (e) {
          console.warn("Failed to sync profile:", e);
        }
      };
      syncProfile();
    }
  }, [user, userName]);

  // Handle Presence and Typing
  useEffect(() => {
    if (!user) return;

    // Set online status
    const userRef = doc(db, "users", user.uid);
    setDoc(userRef, { isOnline: true, lastSeen: Date.now() }, { merge: true });

    // Handle offline on tab close
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setDoc(userRef, { isOnline: false, lastSeen: Date.now() }, { merge: true });
      } else {
        setDoc(userRef, { isOnline: true, lastSeen: Date.now() }, { merge: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      setDoc(userRef, { isOnline: false, lastSeen: Date.now() }, { merge: true });
    };
  }, [user]);

  // Fetch Messages
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch User List
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "users"), orderBy("lastSeen", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(doc => doc.data() as ChatUser);
      setUsers(userList);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuestLoading || isGoogleLoading) return;
    
    const trimmed = inputName.trim();
    if (trimmed && trimmed !== "undefined") {
      setAuthError(null);
      setIsGuestLoading(true);
      
      const color = avatarColors[Math.floor(Math.random() * avatarColors.length)];
      localStorage.setItem("echochat_username", trimmed);
      localStorage.setItem("echochat_color", color);
      
      const timeout = setTimeout(() => {
        if (isGuestLoading) {
          setIsGuestLoading(false);
          setAuthError("Guest sign-in is taking too long. Please try again or refresh.");
        }
      }, 12000);

      try {
        await signInAnonymously(auth);
      } catch (err: any) {
        console.error("Guest Auth error:", err);
        setAuthError(err.message || "Guest sign-in failed.");
        setIsGuestLoading(false);
      } finally {
        clearTimeout(timeout);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading || isGuestLoading) return;
    setAuthError(null);
    setIsGoogleLoading(true);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const timeout = setTimeout(() => {
      if (isGoogleLoading) {
        setIsGoogleLoading(false);
        setShowTroubleshooter(true);
        setAuthError("Google sign-in timed out. If no window appeared, check your popup blocker.");
      }
    }, 25000);

    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google Auth error:", err);
      if (err.code === 'auth/popup-blocked') {
        setAuthError("Popup blocked! Enable popups to sign in with Google.");
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        setAuthError("Sign-in cancelled.");
      } else {
        setAuthError(err.message || "Google login failed.");
      }
      setIsGoogleLoading(false);
    } finally {
      clearTimeout(timeout);
    }
  };

  const forceResetAuth = () => {
    setIsGoogleLoading(false);
    setIsGuestLoading(false);
    setAuthError(null);
    setShowTroubleshooter(false);
    setAuthResetCounter(prev => prev + 1);
  };

  const handleCloseLetter = () => {
    localStorage.setItem("echochat_seen_letter", "true");
    setShowLetter(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && user) {
      const text = message.trim();
      setMessage("");
      
      try {
        await addDoc(collection(db, "messages"), {
          senderId: user.uid,
          senderName: userName,
          senderColor: localStorage.getItem("echochat_color") || "#6366F1",
          text,
          timestamp: serverTimestamp(),
          type: "text"
        });
      } catch (err) {
        console.error("Error sending message:", err);
      }
    }
  };

  const handleLogout = async () => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, { isOnline: false, lastSeen: Date.now() }, { merge: true });
    }
    await auth.signOut();
    localStorage.removeItem("echochat_username");
    localStorage.removeItem("echochat_color");
    localStorage.removeItem("echochat_seen_letter");
    setUserName(null);
    window.location.reload();
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return "";
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const copyInviteLink = () => {
    // @ts-ignore
    const url = process.env.APP_URL || window.location.origin;
    navigator.clipboard.writeText(url);
    alert("Invite link copied to clipboard!");
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
  };

  if (!userName || !user) {
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
              <p className="text-gray-500 mt-1">Join the conversation</p>
              {authError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
                  {authError}
                </div>
              )}
            </div>

            <button 
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isGuestLoading}
              className={`w-full py-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors shadow-sm ${(isGoogleLoading || isGuestLoading) ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isGoogleLoading ? (
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" height="20" alt="Google" referrerPolicy="no-referrer" />
              )}
              {isGoogleLoading ? "Connecting..." : "Continue with Google"}
            </button>

            {showTroubleshooter && (
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={forceResetAuth}
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  Sign-in stuck? Click here to try again.
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="text-[10px] text-gray-400 font-medium hover:underline"
                >
                  Or refresh the entire page.
                </button>
              </div>
            )}

            <div className="flex items-center gap-4 w-full">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs font-bold text-gray-400 uppercase">Or use a guest name</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>

            <form onSubmit={handleLogin} className="w-full space-y-4">
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Enter your guest name"
                className="search-input py-4 text-lg text-center"
              />
              <button 
                type="submit" 
                disabled={isGuestLoading || isGoogleLoading || !inputName.trim()}
                className={`w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 ${(isGuestLoading || isGoogleLoading) ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isGuestLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : null}
                {isGuestLoading ? "Joining..." : "Start as Guest"}
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

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="sidebar-overlay-mobile"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`sidebar flex flex-col ${isSidebarOpen ? 'open' : ''}`}>
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
          <button onClick={copyInviteLink} className="p-2 hover:bg-gray-100 rounded-full text-indigo-600 transition-colors mr-2 flex items-center gap-2 px-3">
            <Search size={16} />
            <span className="text-xs font-bold uppercase">Invite</span>
          </button>
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
                className={`user-item ${u.id === user.uid ? 'bg-indigo-50/50' : ''}`}
              >
                <div className="relative">
                  <div className="avatar" style={{ backgroundColor: u.avatarColor }}>
                    {getInitials(u.name)}
                  </div>
                  {u.isOnline && <div className="status-dot absolute bottom-0 right-0 border-2 border-white" />}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-900 line-clamp-1">{u.name} {u.id === user.uid && "(You)"}</div>
                  <div className="text-[10px] text-gray-500">{u.isOnline ? "Online" : "Offline"}</div>
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
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 hover:bg-gray-100 rounded-full text-indigo-600 transition-colors"
            >
              <User size={24} />
            </button>
            <div className="avatar bg-indigo-600 w-10 h-10 ring-2 ring-indigo-100 shadow-sm hidden sm:flex">
              EC
            </div>
            <div>
              <div className="font-bold text-gray-900 leading-tight">Echo Chat Room</div>
              <div className="typing-indicator flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${user ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-xs text-gray-500">{users.filter(u => u.isOnline).length} online</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <button className="p-2.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
              <Search size={20} />
            </button>
            <button className="p-2.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
              <Settings size={20} />
            </button>
            <button className="p-2.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </header>

        <div className="messages-container">
          <AnimatePresence mode="popLayout" initial={false}>
            {messages.map((msg, idx) => {
              const showDate = idx === 0 || 
                (messages[idx-1].timestamp && msg.timestamp && 
                 new Date(messages[idx-1].timestamp.seconds * 1000).toDateString() !== new Date(msg.timestamp.seconds * 1000).toDateString());

              return (
                <motion.div 
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`flex flex-col ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}
                >
                  {showDate && (
                    <div className="flex justify-center w-full my-6">
                      <span className="px-3 py-1 bg-gray-100/80 backdrop-blur-sm text-[10px] font-bold text-gray-500 rounded-full uppercase tracking-widest border border-gray-200/50 text-center">
                        {msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : "Today"}
                      </span>
                    </div>
                  )}
                  <div className={`message ${msg.senderId === user.uid ? 'sent' : 'received'}`}>
                    {msg.senderId !== user.uid && (
                      <div className="text-[10px] font-bold mb-1 opacity-80" style={{ color: msg.senderColor }}>
                        {msg.senderName}
                      </div>
                    )}
                    <div className="leading-relaxed break-words">{msg.text}</div>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="msg-meta text-[9px] translate-y-0.5">{formatTimestamp(msg.timestamp)}</span>
                      {msg.senderId === user.uid && (
                        <CheckCheck size={12} className="text-indigo-400" />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area-wrapper p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 mb-safe">
          <form onSubmit={handleSendMessage} className="input-area max-w-4xl mx-auto flex gap-2 items-end">
            <div className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 p-1 flex items-end">
              <button type="button" className="p-3 text-gray-400 hover:text-indigo-600 transition-colors">
                <Smile size={22} />
              </button>
              <textarea
                rows={1}
                className="flex-1 bg-transparent border-none focus:ring-0 py-3 px-1 text-[15px] resize-none max-h-32"
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  e.target.style.height = 'inherit';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <button type="button" className="p-3 text-gray-400 hover:text-indigo-600 transition-colors">
                <ImageIcon size={22} />
              </button>
            </div>
            <button 
              type="submit" 
              disabled={!message.trim()} 
              className="send-btn bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 mb-0.5 shadow-lg shadow-indigo-100"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
