import React, { useState, useEffect } from "react";

const API_URL = "http://localhost:3000";

function Settings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [agentStatus, setAgentStatus] = useState(null);
  const [stats, setStats] = useState({ total: 0, breakdown: {} });

  // Simplified configuration state
  const [agentConfig, setAgentConfig] = useState({
    trustedProposers: "",
    blockedProposers: "",
    apiKey: "",
    apiProvider: "openai",
  });

  useEffect(() => {
    loadAgentStatus();
  }, []);

  const showError = (message, duration = 5000) => {
    setError(message);
    setTimeout(() => setError(""), duration);
  };

  const showSuccess = (message, duration = 8000) => {
    setSuccess(message);
    setTimeout(() => setSuccess(""), duration);
  };

  const loadAgentStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/screener/status`);
      const data = await response.json();
      setAgentStatus(data);

      // Load screening results for stats
      const resultsResponse = await fetch(`${API_URL}/api/screener/results`);
      const resultsData = await resultsResponse.json();

      if (resultsData.results) {
        const breakdown = resultsData.results.reduce((acc, result) => {
          acc[result.decision] = (acc[result.decision] || 0) + 1;
          return acc;
        }, {});

        setStats({
          total: resultsData.results.length,
          breakdown: breakdown,
        });
      }
    } catch (error) {
      console.warn("Could not connect to backend agent:", error);
      showError(
        "Backend agent not connected - start your agent with: npm run dev"
      );
    }
  };

  // Test scenarios
  const [testScenario, setTestScenario] = useState({
    title: "",
    description: "",
    proposer_id: "",
    budget: "",
  });

  const runTestScenario = async (scenario) => {
    console.log("🧪 Running test scenario:", scenario.name);

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${API_URL}/api/screener/screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: `test_${scenario.name}_${Date.now()}`,
          proposal: scenario.proposal,
        }),
      });

      const data = await response.json();
      console.log("📥 Test result:", data);

      if (response.ok) {
        const decision = data.decision || "unknown";
        const reasons = data.reasons || ["No reasons provided"];
        const executed = data.executed ? "✅ Executed" : "❌ Not executed";
        const txHash = data.transactionHash || "none";

        setSuccess(
          <div style={{ whiteSpace: "pre-wrap", textAlign: "left" }}>
            <strong>🧪 Test: {scenario.name}</strong>
            <br />
            <br />
            <strong>Decision:</strong>{" "}
            <span style={{ color: decision === "approve" ? "green" : "red" }}>
              {decision.toUpperCase()}
            </span>
            <br />
            <strong>Status:</strong> {executed}
            <br />
            <strong>TX Hash:</strong> <code>{txHash}</code>
            <br />
            <br />
            <strong>AI Reasoning:</strong>
            <ul style={{ margin: "10px 0", paddingLeft: "20px" }}>
              {reasons.map((reason, i) => (
                <li key={i} style={{ marginBottom: "5px" }}>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        );

        await loadAgentStatus();
      } else {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("❌ Test failed:", error);
      showError(`Test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runCustomTest = async () => {
    if (!testScenario.title || !testScenario.description) {
      showError("Please fill in at least title and description");
      return;
    }

    await runTestScenario({
      name: "Custom",
      proposal: {
        title: testScenario.title,
        description: testScenario.description,
        proposer_id: testScenario.proposer_id || "custom.near",
        budget: testScenario.budget ? parseInt(testScenario.budget) : undefined,
      },
    });
  };
  const testAIConnection = async () => {
    const scenario = {
      name: "Basic Connection",
      proposal: {
        title: "NEAR Developer Grant Program",
        description:
          "A comprehensive program to fund innovative NEAR Protocol applications, smart contracts, and developer tools. This initiative will provide grants ranging from $5,000 to $50,000 to qualified developers building on NEAR. The program includes mentorship, technical support, and marketing assistance to help projects succeed. We aim to fund 20 high-quality projects over 6 months.",
        proposer_id: "developer-dao.near",
        budget: 25000,
      },
    };

    await runTestScenario(scenario);
  };

  const handleInputChange = (field, value) => {
    setAgentConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const applyPreset = (presetName) => {
    const presets = {
      permissive: {
        trustedProposers: "foundation.near, nearfi.near",
        blockedProposers: "",
        apiProvider: "openai",
      },
      conservative: {
        trustedProposers: "foundation.near",
        blockedProposers: "badactor.near, scammer.near",
        apiProvider: "openai",
      },
      security: {
        trustedProposers: "foundation.near",
        blockedProposers: "badactor.near, anonymous.near",
        apiProvider: "anthropic",
      },
    };

    const preset = presets[presetName];
    if (preset) {
      setAgentConfig((prev) => ({ ...prev, ...preset }));
      setError("");
      setSuccess(`Applied ${presetName} preset configuration`);
    }
  };

  const resetToDefaults = () => {
    setAgentConfig({
      trustedProposers: "",
      blockedProposers: "",
      apiKey: "",
      apiProvider: "openai",
    });
    setError("");
    setSuccess("");
  };

  return (
    <div className="container-fluid">
      <div className="panel">
        <h2>🤖 AI Agent Configuration</h2>
        <p style={{ color: "#333", marginBottom: "20px" }}>
          Configure your autonomous AI agent. The agent uses AI to evaluate
          proposals and can automatically approve or reject them.
        </p>

        {error && (
          <div
            style={{
              padding: "15px",
              background: "#f8d7da",
              border: "1px solid #f5c6cb",
              borderRadius: "8px",
              marginBottom: "20px",
              color: "#721c24",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {success && (
          <div
            style={{
              padding: "15px",
              background: "#d4edda",
              border: "1px solid #c3e6cb",
              borderRadius: "8px",
              marginBottom: "20px",
              color: "#155724",
            }}
          >
            {typeof success === "string" ? success : success}
          </div>
        )}

        {/* Agent Status */}
        <div className="criteria-section">
          <h3>📊 Agent Status</h3>
          {agentStatus ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "15px",
              }}
            >
              <div
                style={{
                  background: "white",
                  padding: "15px",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                }}
              >
                <strong>Autonomous Mode:</strong>
                <br />
                <span
                  style={{
                    color: agentStatus.autonomousMode ? "green" : "red",
                  }}
                >
                  {agentStatus.autonomousMode ? "✅ Active" : "❌ Disabled"}
                </span>
              </div>
              <div
                style={{
                  background: "white",
                  padding: "15px",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                }}
              >
                <strong>Configuration:</strong>
                <br />
                <span
                  style={{ color: agentStatus.configured ? "green" : "red" }}
                >
                  {agentStatus.configured
                    ? "✅ Configured"
                    : "❌ Missing Config"}
                </span>
              </div>
              <div
                style={{
                  background: "white",
                  padding: "15px",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                }}
              >
                <strong>Proposals Screened:</strong>
                <br />
                <span style={{ fontSize: "24px", fontWeight: "bold" }}>
                  {stats.total}
                </span>
              </div>
              <div
                style={{
                  background: "white",
                  padding: "15px",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                }}
              >
                <strong>Agent Account:</strong>
                <br />
                <code style={{ fontSize: "12px" }}>
                  {agentStatus.agentAccount || "Not set"}
                </code>
              </div>
            </div>
          ) : (
            <p style={{ color: "#666" }}>Loading agent status...</p>
          )}
        </div>

        {/* AI Configuration */}
        <div className="criteria-section">
          <h3>🧠 AI Configuration</h3>
          <div className="input-group">
            <label>AI Provider</label>
            <select
              value={agentConfig.apiProvider}
              onChange={(e) => handleInputChange("apiProvider", e.target.value)}
              disabled={loading}
            >
              <option value="openai">OpenAI (GPT-4)</option>
              <option value="anthropic">Anthropic (Claude)</option>
            </select>
            <small style={{ color: "#666" }}>
              Choose your AI provider for proposal analysis
            </small>
          </div>

          <div className="input-group">
            <label>API Key</label>
            <input
              type="password"
              value={agentConfig.apiKey}
              onChange={(e) => handleInputChange("apiKey", e.target.value)}
              disabled={loading}
              placeholder={
                agentConfig.apiProvider === "openai"
                  ? "sk-..."
                  : "your-anthropic-key"
              }
            />
            <small style={{ color: "#666" }}>
              {agentConfig.apiProvider === "openai"
                ? "Your OpenAI API key (or set OPENAI_API_KEY environment variable)"
                : "Your Anthropic API key (or set ANTHROPIC_API_KEY environment variable)"}
            </small>
          </div>
        </div>

        {/* Proposer Rules */}
        <div className="criteria-section">
          <h3>👤 Proposer Rules</h3>
          <div className="input-group">
            <label>Trusted Proposers (comma separated)</label>
            <input
              type="text"
              value={agentConfig.trustedProposers}
              onChange={(e) =>
                handleInputChange("trustedProposers", e.target.value)
              }
              disabled={loading}
              placeholder="e.g. foundation.near, nearfi.near"
            />
            <small style={{ color: "#666" }}>
              Proposals from these accounts will be automatically approved
              without AI analysis
            </small>
          </div>

          <div className="input-group">
            <label>Blocked Proposers (comma separated)</label>
            <input
              type="text"
              value={agentConfig.blockedProposers}
              onChange={(e) =>
                handleInputChange("blockedProposers", e.target.value)
              }
              disabled={loading}
              placeholder="e.g. badactor.near, scammer.near"
            />
            <small style={{ color: "#666" }}>
              Proposals from these accounts will be automatically rejected
            </small>
          </div>
        </div>

        {/* Screening Results */}
        {stats.total > 0 && (
          <div className="criteria-section">
            <h3>📊 Screening Results</h3>
            <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
              {Object.entries(stats.breakdown).map(([decision, count]) => (
                <div
                  key={decision}
                  style={{
                    background: decision === "approve" ? "#d4edda" : "#f8d7da",
                    padding: "10px 15px",
                    borderRadius: "8px",
                    border: `1px solid ${
                      decision === "approve" ? "#c3e6cb" : "#f5c6cb"
                    }`,
                  }}
                >
                  <strong style={{ textTransform: "capitalize" }}>
                    {decision}:
                  </strong>{" "}
                  {count}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={testAIConnection}
            disabled={loading}
            style={{
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "🔄 Testing..." : "🧪 Quick AI Test"}
          </button>

          <button
            className="btn btn-secondary"
            onClick={resetToDefaults}
            disabled={loading}
          >
            🔄 Reset to Defaults
          </button>
        </div>

        {/* AI Test Scenarios */}
        <div className="criteria-section">
          <h3>🧪 AI Test Scenarios</h3>
          <p style={{ color: "#666", marginBottom: "15px" }}>
            Test your AI agent with different proposal scenarios to see how it
            analyzes and decides.
          </p>

          {/* Preset Scenarios */}
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ fontSize: "16px", marginBottom: "10px" }}>
              Quick Test Scenarios:
            </h4>
            <div className="button-group">
              <button
                className="btn btn-success"
                onClick={() =>
                  runTestScenario({
                    name: "Good Project",
                    proposal: {
                      title: "NEAR Developer Education Initiative",
                      description:
                        "A comprehensive educational program to onboard new developers to the NEAR ecosystem. This initiative includes creating video tutorials, documentation, workshops, and mentorship programs. The project aims to increase developer adoption by 50% over 6 months through high-quality educational content and hands-on learning experiences.",
                      proposer_id: "education.near",
                      budget: 15000,
                    },
                  })
                }
                disabled={loading}
              >
                ✅ Good Project
              </button>

              <button
                className="btn btn-danger"
                onClick={() =>
                  runTestScenario({
                    name: "Suspicious Project",
                    proposal: {
                      title: "Amazing Investment Opportunity",
                      description:
                        "Get rich quick with this amazing investment scheme! Guaranteed 1000% returns in just 30 days. No risk involved! Send me your NEAR tokens and I'll double them overnight using my secret trading algorithm.",
                      proposer_id: "totallylegit.near",
                      budget: 100000,
                    },
                  })
                }
                disabled={loading}
              >
                ❌ Suspicious Project
              </button>

              <button
                className="btn btn-warning"
                onClick={() =>
                  runTestScenario({
                    name: "Ambitious Project",
                    proposal: {
                      title: "Build the Metaverse on NEAR",
                      description:
                        "Revolutionary metaverse platform that will change everything. We need $500k to build a virtual world with AI, VR, blockchain gaming, NFTs, and DeFi all combined. No technical details available yet but trust us it will be amazing.",
                      proposer_id: "bigdreams.near",
                      budget: 500000,
                    },
                  })
                }
                disabled={loading}
              >
                ⚠️ Ambitious Project
              </button>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  runTestScenario({
                    name: "Technical Project",
                    proposal: {
                      title: "NEAR Protocol Performance Optimization",
                      description:
                        "Technical improvements to NEAR Protocol's consensus mechanism focusing on transaction throughput optimization. Our team has identified specific bottlenecks in the block validation process and proposes implementing a new caching layer with benchmark improvements of 15-20% transaction speed.",
                      proposer_id: "nearcore.near",
                      budget: 30000,
                    },
                  })
                }
                disabled={loading}
              >
                🔧 Technical Project
              </button>
            </div>
          </div>

          {/* Custom Test Form */}
          <div
            style={{
              background: "#f8f9fa",
              padding: "20px",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
            }}
          >
            <h4 style={{ fontSize: "16px", marginBottom: "15px" }}>
              Custom Test Proposal:
            </h4>

            <div className="input-group">
              <label>Proposal Title</label>
              <input
                type="text"
                value={testScenario.title}
                onChange={(e) =>
                  setTestScenario((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                disabled={loading}
                placeholder="e.g. NEAR Community Fund"
              />
            </div>

            <div className="input-group">
              <label>Description</label>
              <textarea
                value={testScenario.description}
                onChange={(e) =>
                  setTestScenario((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                disabled={loading}
                placeholder="Detailed description of the proposal..."
                style={{ minHeight: "100px" }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "15px",
              }}
            >
              <div className="input-group">
                <label>Proposer ID</label>
                <input
                  type="text"
                  value={testScenario.proposer_id}
                  onChange={(e) =>
                    setTestScenario((prev) => ({
                      ...prev,
                      proposer_id: e.target.value,
                    }))
                  }
                  disabled={loading}
                  placeholder="proposer.near"
                />
              </div>

              <div className="input-group">
                <label>Budget (USD)</label>
                <input
                  type="number"
                  value={testScenario.budget}
                  onChange={(e) =>
                    setTestScenario((prev) => ({
                      ...prev,
                      budget: e.target.value,
                    }))
                  }
                  disabled={loading}
                  placeholder="10000"
                />
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={runCustomTest}
              disabled={
                loading || !testScenario.title || !testScenario.description
              }
              style={{ marginTop: "15px" }}
            >
              {loading ? "🔄 Testing..." : "🧪 Test Custom Proposal"}
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="criteria-section">
          <h3>⚡ Quick Presets</h3>
          <div className="button-group">
            <button
              className="btn btn-success"
              onClick={() => applyPreset("permissive")}
              disabled={loading}
            >
              🟢 Permissive
            </button>
            <button
              className="btn btn-warning"
              onClick={() => applyPreset("conservative")}
              disabled={loading}
            >
              🟡 Conservative
            </button>
            <button
              className="btn btn-danger"
              onClick={() => applyPreset("security")}
              disabled={loading}
            >
              🔴 Security Focused
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div
          style={{
            background: "#e7f3ff",
            padding: "20px",
            borderRadius: "8px",
            marginTop: "20px",
            border: "1px solid #bee5eb",
          }}
        >
          <h4>🔧 Setup & Testing Guide:</h4>
          <ol style={{ paddingLeft: "20px", margin: "10px 0" }}>
            <li>Set your API key above or in environment variables</li>
            <li>Configure trusted/blocked proposers (optional)</li>
            <li>
              Use the <strong>🧪 AI Test Scenarios</strong> to see how your
              agent analyzes different proposals
            </li>
            <li>
              Try the preset scenarios: Good Project (should approve) vs
              Suspicious Project (should reject)
            </li>
            <li>
              Create custom test proposals to fine-tune your understanding
            </li>
            <li>
              Once satisfied, your agent will automatically screen real
              proposals
            </li>
          </ol>
          <p style={{ margin: "10px 0", fontSize: "14px", color: "#666" }}>
            <strong>💡 Pro Tip:</strong> The AI analyzes proposal quality,
            legitimacy, ecosystem benefit, and feasibility. Test different
            scenarios to understand its decision-making process!
          </p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
