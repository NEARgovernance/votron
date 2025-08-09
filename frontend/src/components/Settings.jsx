import { useState, useEffect } from "react";
import { Constants } from "../hooks/constants.js";

export function Settings() {
  const [agentStatus, setAgentStatus] = useState(null);
  const [agentBalance, setAgentBalance] = useState(null);
  const [agentInfo, setAgentInfo] = useState(null);
  const [screeningStats, setScreeningStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);

  useEffect(() => {
    fetchAllAgentData();
  }, []);

  const fetchAllAgentData = async () => {
    await Promise.all([
      fetchAgentStatus(),
      fetchAgentBalance(),
      fetchAgentInfo(),
      fetchScreeningStats(),
    ]);
  };

  const fetchAgentStatus = async () => {
    try {
      const response = await fetch(`${Constants.API_URL}/api/screener/status`);
      const data = await response.json();
      setAgentStatus(data);
    } catch (error) {
      console.error("Failed to fetch agent status:", error);
    }
  };

  const fetchAgentBalance = async () => {
    try {
      const response = await fetch(`${Constants.API_URL}/api/screener/balance`);
      const data = await response.json();
      setAgentBalance(data);
    } catch (error) {
      console.error("Failed to fetch agent balance:", error);
    }
  };

  const fetchAgentInfo = async () => {
    try {
      const response = await fetch(
        `${Constants.API_URL}/api/screener/agent-info`
      );
      const data = await response.json();
      setAgentInfo(data);
    } catch (error) {
      console.error("Failed to fetch agent info:", error);
    }
  };

  const fetchScreeningStats = async () => {
    try {
      const response = await fetch(`${Constants.API_URL}/api/screener/results`);
      const data = await response.json();
      const results = data.results || [];

      const stats = {
        total: results.length,
        approved: results.filter((r) => r.approved).length,
        rejected: results.filter((r) => !r.approved).length,
        withExecution: results.filter((r) => r.executionResult).length,
      };
      setScreeningStats(stats);
    } catch (error) {
      console.error("Failed to fetch screening stats:", error);
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    setTestResults(null);

    const results = {
      timestamp: new Date().toLocaleString(),
      tests: [],
    };

    try {
      // Test 1: API Health Check
      try {
        const healthResponse = await fetch(`${Constants.API_URL}/`);
        const healthData = await healthResponse.json();
        results.tests.push({
          name: "API Health Check",
          status: "success",
          message: `Server running, uptime: ${healthData.uptime}s`,
        });
      } catch (error) {
        results.tests.push({
          name: "API Health Check",
          status: "error",
          message: error.message,
        });
      }

      // Test 2: Agent Status
      try {
        const statusResponse = await fetch(
          `${Constants.API_URL}/api/screener/status`
        );
        const statusData = await statusResponse.json();
        results.tests.push({
          name: "Agent Status",
          status: "success",
          message: `Mode: ${
            statusData.autonomousMode ? "Autonomous" : "Monitor"
          }, Screened: ${statusData.totalScreened}`,
        });
      } catch (error) {
        results.tests.push({
          name: "Agent Status",
          status: "error",
          message: error.message,
        });
      }

      // Test 3: Contract Connection
      try {
        const connectionResponse = await fetch(
          `${Constants.API_URL}/api/screener/test-connection`
        );
        const connectionData = await connectionResponse.json();
        results.tests.push({
          name: "Contract Connection",
          status: connectionData.success ? "success" : "warning",
          message: connectionData.message || connectionData.error,
        });
      } catch (error) {
        results.tests.push({
          name: "Contract Connection",
          status: "error",
          message: error.message,
        });
      }

      // Test 4: Agent Balance
      try {
        const balanceResponse = await fetch(
          `${Constants.API_URL}/api/screener/balance`
        );
        const balanceData = await balanceResponse.json();
        results.tests.push({
          name: "Agent Balance",
          status: "success",
          message: `${balanceData.balanceInNEAR} NEAR (${balanceData.agentAccount})`,
        });
      } catch (error) {
        results.tests.push({
          name: "Agent Balance",
          status: "error",
          message: error.message,
        });
      }

      // Test 5: Mock Proposal Screening
      try {
        const mockProposal = {
          title: "Test Proposal for Diagnostics",
          description:
            "This is a test proposal to verify AI screening functionality.",
          proposer_id: "test.testnet",
        };

        const screenResponse = await fetch(
          `${Constants.API_URL}/api/screener/screen`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              proposalId: "test-diagnostic",
              proposal: mockProposal,
            }),
          }
        );
        const screenData = await screenResponse.json();

        results.tests.push({
          name: "AI Screening Test",
          status: "success",
          message: `Result: ${
            screenData.approved ? "APPROVED" : "REJECTED"
          } | Reasons: ${screenData.reasons?.join(", ") || "None"}`,
        });
      } catch (error) {
        results.tests.push({
          name: "AI Screening Test",
          status: "error",
          message: error.message,
        });
      }

      setTestResults(results);

      // Refresh data after tests
      await fetchAllAgentData();
    } catch (error) {
      setTestResults({
        timestamp: new Date().toLocaleString(),
        error: error.message,
        tests: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      success: "bg-success",
      warning: "bg-warning",
      error: "bg-danger",
    };
    return colors[status] || "bg-secondary";
  };

  return (
    <div className="container-fluid">
      <div className="panel">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>⚙️ AI Agent Management</h2>
          <button
            className="btn btn-primary"
            onClick={runDiagnostics}
            disabled={loading}
          >
            {loading ? "🔄 Running Diagnostics..." : "🧪 Run Full Diagnostics"}
          </button>
        </div>

        {/* System Configuration */}
        <div className="card mb-4">
          <div className="card-header">
            <h5>🔧 System Configuration</h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6">
                <p>
                  <strong>Voting Contract:</strong>{" "}
                  <code>{Constants.VOTING_CONTRACT_ID}</code>
                </p>
                <p>
                  <strong>Agent Contract:</strong>{" "}
                  <code>{Constants.AGENT_ACCOUNT_ID}</code>
                </p>
                <p>
                  <strong>Votron API:</strong> <code>{Constants.API_URL}</code>
                </p>
              </div>
              <div className="col-md-6">
                {agentStatus && (
                  <>
                    <p>
                      <strong>Agent Mode:</strong>
                      <span
                        className={`badge ms-2 ${
                          agentStatus.autonomousMode
                            ? "bg-success"
                            : "bg-warning"
                        }`}
                      >
                        {agentStatus.autonomousMode
                          ? "Autonomous"
                          : "Monitor Only"}
                      </span>
                    </p>
                    <p>
                      <strong>Agent Account:</strong>{" "}
                      <code>{agentStatus.agentAccount}</code>
                    </p>
                    <p>
                      <strong>Total Screened:</strong>{" "}
                      {agentStatus.totalScreened}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Agent Status & Stats */}
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h6>🤖 Agent Status</h6>
              </div>
              <div className="card-body">
                {agentBalance ? (
                  <>
                    <p>
                      <strong>Balance:</strong> {agentBalance.balanceInNEAR}{" "}
                      NEAR
                    </p>
                    <p>
                      <strong>Account:</strong>{" "}
                      <code>{agentBalance.agentAccount}</code>
                    </p>
                    <small className="text-muted">
                      Raw: {agentBalance.balance?.available || "Unknown"}{" "}
                      yoctoNEAR
                    </small>
                  </>
                ) : (
                  <p className="text-muted">Loading balance...</p>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h6>📊 Screening Statistics</h6>
              </div>
              <div className="card-body">
                {screeningStats ? (
                  <>
                    <p>
                      <strong>Total Screened:</strong> {screeningStats.total}
                    </p>
                    <p>
                      <strong>Approved:</strong> {screeningStats.approved}
                    </p>
                    <p>
                      <strong>Rejected:</strong> {screeningStats.rejected}
                    </p>
                    <p>
                      <strong>With Execution:</strong>{" "}
                      {screeningStats.withExecution}
                    </p>
                  </>
                ) : (
                  <p className="text-muted">Loading stats...</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Agent Information */}
        {agentInfo && (
          <div className="card mb-4">
            <div className="card-header">
              <h5>📋 Agent Details</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <p>
                    <strong>Runtime Account:</strong>{" "}
                    <code>{agentInfo.agentAccountId}</code>
                  </p>
                  <p>
                    <strong>Configured Account:</strong>{" "}
                    <code>{agentInfo.configuredAccountId}</code>
                  </p>
                  <p>
                    <strong>Voting Contract:</strong>{" "}
                    <code>{agentInfo.votingContract}</code>
                  </p>
                </div>
                <div className="col-md-6">
                  <p>
                    <strong>Custom Contract:</strong>{" "}
                    {agentInfo.customContract || "None"}
                  </p>
                  <p>
                    <strong>Execution Mode:</strong> {agentInfo.mode}
                  </p>
                  <p>
                    <strong>Status:</strong>
                    <span className="badge bg-success ms-2">Active</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Diagnostic Results */}
        {testResults && (
          <div className="card mb-4">
            <div className="card-header">
              <h5>🧪 Diagnostic Results ({testResults.timestamp})</h5>
            </div>
            <div className="card-body">
              {testResults.error ? (
                <div className="alert alert-danger">
                  <strong>Diagnostics Failed:</strong> {testResults.error}
                </div>
              ) : (
                <div>
                  {testResults.tests.map((test, index) => (
                    <div
                      key={index}
                      className="d-flex justify-content-between align-items-center mb-2 p-2 border rounded"
                    >
                      <div>
                        <strong>{test.name}</strong>
                        <br />
                        <small className="text-muted">{test.message}</small>
                      </div>
                      <span className={`badge ${getStatusBadge(test.status)}`}>
                        {test.status.toUpperCase()}
                      </span>
                    </div>
                  ))}

                  <div className="mt-3 text-center">
                    {testResults.tests.every((t) => t.status === "success") ? (
                      <div className="alert alert-success">
                        🎉 All diagnostics passed! Your AI agent is fully
                        operational.
                      </div>
                    ) : (
                      <div className="alert alert-warning">
                        ⚠️ Some tests failed. Check the results above for
                        details.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h5>⚡ Quick Actions</h5>
          </div>
          <div className="card-body">
            <div className="d-flex gap-2 flex-wrap">
              <button
                className="btn btn-outline-primary"
                onClick={fetchAllAgentData}
                disabled={loading}
              >
                🔄 Refresh Data
              </button>

              <button
                className="btn btn-outline-info"
                onClick={() =>
                  window.open(
                    `${Constants.API_URL}/api/debug/websocket-status`,
                    "_blank"
                  )
                }
              >
                📡 WebSocket Status
              </button>

              <button
                className="btn btn-outline-success"
                onClick={() =>
                  window.open(
                    `${Constants.API_URL}/api/screener/results`,
                    "_blank"
                  )
                }
              >
                📊 View Raw Results
              </button>

              <button
                className="btn btn-outline-secondary"
                onClick={() => window.open(`${Constants.API_URL}`, "_blank")}
              >
                🏠 Agent Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
