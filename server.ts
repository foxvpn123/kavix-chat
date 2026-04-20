import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // In-memory data store (since Firebase was unavailable)
  const messages: any[] = [];
  const users = new Map<string, { id: string; name: string; avatarColor: string }>();

  const avatarColors = [
    "#6366F1", "#EC4899", "#F59E0B", "#10B981", "#8B5CF6", "#3B82F6", "#EF4444"
  ];

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join", (userName: string) => {
      const color = avatarColors[Math.floor(Math.random() * avatarColors.length)];
      users.set(socket.id, { id: socket.id, name: userName, avatarColor: color });
      
      // Update all clients with the new user list
      io.emit("userList", Array.from(users.values()));
      
      // Send message history to the new user
      socket.emit("messageHistory", messages);
      
      console.log(`${userName} joined.`);
    });

    socket.on("sendMessage", (text: string) => {
      const user = users.get(socket.id);
      if (user) {
        const newMessage = {
          id: Date.now().toString(),
          senderId: user.id,
          senderName: user.name,
          senderColor: user.avatarColor,
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: Date.now()
        };
        messages.push(newMessage);
        // Keep last 100 messages
        if (messages.length > 100) messages.shift();
        
        io.emit("message", newMessage);
      }
    });

    socket.on("disconnect", () => {
      const user = users.get(socket.id);
      if (user) {
        console.log(`${user.name} disconnected.`);
        users.delete(socket.id);
        io.emit("userList", Array.from(users.values()));
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
