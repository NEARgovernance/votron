import { useState } from "react";
import { Connect } from "./Connect.jsx";

export function Navbar({ accountId, activeTab, setActiveTab }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="navbar navbar-expand-lg navbar-light bg-white sticky-top border-bottom shadow-sm">
      <div className="container-fluid px-4">
        {/* Navigation */}
        <div
          className={`collapse navbar-collapse ${mobileMenuOpen ? "show" : ""}`}
        >
          <div className="navbar-nav ms-auto d-flex flex-row align-items-center gap-3">
            {/* Navigation Tabs */}
            <div className="d-flex gap-2">
              <button
                className={`btn btn-sm ${
                  activeTab === "home" ? "btn-dark" : "btn-outline-dark"
                }`}
                onClick={() => {
                  setActiveTab("home");
                  closeMobileMenu();
                }}
              >
                📋 Proposals
              </button>
              <div onClick={closeMobileMenu}>
                <Connect accountId={accountId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
