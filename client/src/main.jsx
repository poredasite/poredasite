import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#161d27",
            color: "#e8eaed",
            border: "1px solid #263040",
            fontFamily: "'Inter', sans-serif",
          },
          success: {
            iconTheme: { primary: "#ff6b00", secondary: "#080b0f" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#080b0f" },
          },
        }}
      />
    </HelmetProvider>
  </React.StrictMode>
);
