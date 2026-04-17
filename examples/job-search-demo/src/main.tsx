import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import "@llm-workbench/ui/theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
