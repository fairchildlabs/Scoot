import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add REPL_ID to window object if we're in Replit environment
if (import.meta.env.REPL_ID) {
  window.REPL_ID = import.meta.env.REPL_ID;
}

createRoot(document.getElementById("root")!).render(<App />);