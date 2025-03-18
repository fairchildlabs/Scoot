import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

console.log("Starting server initialization...");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add an unprotected test route
app.get('/test', (_req, res) => {
  res.send('Hello World - Test Route');
});

// Basic request logging middleware
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
  try {
    console.log("Starting route registration phase...");
    const server = await registerRoutes(app);
    console.log("Routes registered successfully");

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error("Error middleware caught:", { status, message, err });
      res.status(status).json({ message });
    });

    // Start server first
    console.log("Attempting to bind to port 5000...");
    server.listen(5000, '0.0.0.0', async () => {
      console.log("Server successfully started on port 5000");
      log("serving on port 5000");

      // Setup environment-specific middleware after server is listening
      console.log("Setting up environment-specific middleware...");
      try {
        if (app.get("env") === "development") {
          console.log("Setting up Vite for development...");
          await setupVite(app, server);
          console.log("Vite setup complete");
        } else {
          console.log("Setting up static file serving...");
          serveStatic(app);
          console.log("Static file serving setup complete");
        }
      } catch (setupError) {
        console.error("Error during middleware setup:", setupError);
        // Don't exit process, just log the error since server is already running
      }
    });

    server.on('error', (err: any) => {
      console.error("Server error occurred:", err);
      process.exit(1);
    });

  } catch (err) {
    console.error("Fatal error during server startup:", err);
    process.exit(1);
  }
})();