import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import os from "os";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    console.log(`[Server] GET /api/health - ${new Date().toISOString()}`);
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      server: "running"
    });
  });

  app.get("/api/info", (req, res) => {
    console.log(`[Server] GET /api/info - ${new Date().toISOString()}`);
    const networkInterfaces = os.networkInterfaces();
    let ip = "unknown";
    
    // Simple logic to find a non-internal IPv4 address
    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name]!) {
        if (net.family === "IPv4" && !net.internal) {
          ip = net.address;
          break;
        }
      }
      if (ip !== "unknown") break;
    }

    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      ip: ip,
      env: process.env.NODE_ENV || "development"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] VPS Monitor Backend running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Health endpoint: http://0.0.0.0:${PORT}/api/health`);
  });
}

startServer();
