import express from "express";

console.log("Starting minimal test server...");
console.log("Environment PORT:", process.env.PORT);

const app = express();

// Single test route
app.get('/test', (_req, res) => {
  res.send('Test server is running');
});

// Basic error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).send('Server error');
});

console.log("Attempting to bind to port 3000...");
const server = app.listen(3000, '0.0.0.0', () => {
  console.log("Test server successfully started on port 3000");
});

server.on('error', (err: any) => {
  console.error("Server startup error:", err);
  console.error("Full error details:", {
    code: err.code,
    errno: err.errno,
    syscall: err.syscall,
    address: err.address,
    port: err.port,
    stack: err.stack
  });
  process.exit(1);
});