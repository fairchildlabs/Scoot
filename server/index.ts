import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add an unprotected test route
app.get('/test', (_req, res) => {
  res.send('Hello World - Test Route');
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Modified port binding logic with better error handling and logging
  const startServer = (port: number): Promise<number> => {
    return new Promise((resolve, reject) => {
      log(`Attempting to start server on port ${port}...`);

      const serverInstance = server.listen({
        port,
        host: "0.0.0.0",
        reusePort: true,
      });

      serverInstance.once('listening', () => {
        log(`Server successfully started on port ${port}`);
        resolve(port);
      });

      serverInstance.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          log(`Port ${port} is in use, will try port ${port + 1}`);
          serverInstance.close();
          startServer(port + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  };

  try {
    const port = await startServer(5000);
    log(`Server is running on port ${port}`);
  } catch (err) {
    log(`Failed to start server: ${(err as Error).message}`);
    process.exit(1);
  }
})();