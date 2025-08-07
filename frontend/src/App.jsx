import React, { useState } from "react";
import "../styles/globals.css";
import Home from "./components/Proposals.jsx";
import Settings from "./components/Settings.jsx";
import { Constants } from "./hooks/constants.js";

const DEFAULT_CONTRACT_ID =
  Constants.VOTING_CONTRACT_ID || "shade.ballotbox.testnet";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");

  const renderActivePage = () => {
    switch (activeTab) {
      case "home":
        return <Home />;
      case "config":
        return <Settings />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="container">
      {/* Main Content */}
      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "30px 40px",
        }}
      >
        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "30px",
            paddingBottom: "10px",
            justifyContent: "center",
          }}
        >
          <button
            style={{
              background: activeTab === "home" ? "black" : "white",
              color: activeTab === "home" ? "white" : "black",
              border: "1px solid black",
              padding: "10px 20px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
            onClick={() => setActiveTab("home")}
          >
            📋 Proposals
          </button>
          <button
            style={{
              background: activeTab === "config" ? "black" : "white",
              color: activeTab === "config" ? "white" : "black",
              border: "1px solid black",
              padding: "10px 20px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
            onClick={() => setActiveTab("config")}
          >
            ⚙️ Criteria
          </button>
        </div>

        {/* Render Active Page */}
        {renderActivePage()}
        {/* Footer */}
        <footer
          style={{
            textAlign: "center",
            padding: "15px",
            marginTop: "23px",
          }}
        >
          <p style={{ margin: 0 }}>
            <a
              href="https://github.com/neargovernance"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#adb5bd", textDecoration: "none" }}
            >
              Built for NEAR Governance
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
