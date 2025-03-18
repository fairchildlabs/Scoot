import express from "express";

console.log("Starting minimal server initialization...");
console.log("Environment PORT:", process.env.PORT);

const app = express();

// Add an unprotected test route (from original code)
app.get('/test', (_req, res) => {
  res.send('Hello World - Test Route');
});

// Basic error handling middleware (from edited code)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Error middleware caught:", { status, message, err });
  res.status(status).json({ message });
});

// Start server on port 5000 as required by Replit
console.log("Attempting to bind to port 5000...");
const server = app.listen(5000, '0.0.0.0', () => {
  console.log("Server successfully started on port 5000");
});

server.on('error', (err: any) => {
  console.error("Server startup error:", {
    code: err.code,
    errno: err.errno,
    syscall: err.syscall,
    address: err.address,
    port: err.port,
    stack: err.stack
  });
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});