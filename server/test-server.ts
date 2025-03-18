import express from "express";

console.log("Starting minimal test server...");

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

console.log("Attempting to bind to port 5000...");
const server = app.listen(5000, '0.0.0.0', () => {
  console.log("Test server successfully started on port 5000");
});

server.on('error', (err: any) => {
  console.error("Server startup error:", err);
  process.exit(1);
});
