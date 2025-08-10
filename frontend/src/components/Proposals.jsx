import { useState, useMemo, useEffect } from "react";
import { useProposals } from "../hooks/useProposals.js";
import { ProposalCard } from "../components/ProposalCard.jsx";
import { Constants } from "../hooks/constants.js";

const PROPOSALS_PER_PAGE = 10;

export function Proposals({ accountId }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [agentStatus, setAgentStatus] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [autoApprovalStats, setAutoApprovalStats] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Get current proposals from voting contract
  const { proposals, loading, error, refetch } = useProposals(
    Constants.VOTING_CONTRACT_ID
  );

  // Fetch agent data on component mount and periodically
  useEffect(() => {
    fetchAllAgentData();

    // Refresh every 5 seconds for live demo
    const interval = setInterval(fetchAllAgentData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllAgentData = async () => {
    try {
      await Promise.all([
        fetchAgentStatus(),
        fetchAutoApprovalStats(),
        fetchExecutionHistory(),
      ]);
    } catch (error) {
      console.error("Failed to fetch agent data:", error);
    }
  };

  const fetchAgentStatus = async () => {
    try {
      const response = await fetch(
        `${Constants.API_URL}/api/screener/agent-status`
      );
      if (response.ok) {
        const data = await response.json();
        setAgentStatus(data);
      } else {
        console.error("Failed to fetch agent status:", response.status);
      }
    } catch (error) {
      console.error("Failed to fetch agent status:", error);
    }
  };

  const fetchAutoApprovalStats = async () => {
    try {
      const response = await fetch(
        `${Constants.API_URL}/api/screener/auto-approval-stats`
      );
      if (response.ok) {
        const data = await response.json();
        setAutoApprovalStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch auto-approval stats:", error);
    }
  };

  const fetchExecutionHistory = async () => {
    try {
      const response = await fetch(
        `${Constants.API_URL}/api/screener/execution-history`
      );
      if (response.ok) {
        const data = await response.json();
        setExecutionHistory(data.executions || []);
      }
    } catch (error) {
      console.error("Failed to fetch execution history:", error);
    }
  };

  // Test agent contract approval
  const testAgentApproval = async () => {
    setTestLoading(true);
    setTestResult(null);

    try {
      const testProposalId = "13"; // Default test proposal

      console.log(
        `🧪 Testing agent contract approval for proposal ${testProposalId}...`
      );

      const response = await fetch(
        `${Constants.API_URL}/api/screener/agent-approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            proposalId: testProposalId,
            force: true, // Override any AI rejection for testing
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setTestResult({
          success: true,
          type: "agent-approval",
          proposalId: testProposalId,
          txHash: result.result?.transaction?.hash || result.result?.txHash,
          message: `✅ Agent contract approval successful!`,
          details: result,
          timestamp: new Date().toLocaleString(),
        });

        // Refresh data to show updates
        setTimeout(fetchAllAgentData, 2000);
      } else {
        setTestResult({
          success: false,
          type: "agent-approval",
          error: result.error || "Unknown error",
          agentValid: result.agentValid,
          timestamp: new Date().toLocaleString(),
        });
      }
    } catch (error) {
      console.error("❌ Agent approval test failed:", error);
      setTestResult({
        success: false,
        type: "agent-approval",
        error: error.message,
        timestamp: new Date().toLocaleString(),
      });
    } finally {
      setTestLoading(false);
    }
  };

  const createTestProposal = async () => {
    if (!accountId) {
      alert("Please sign in first to create a test proposal");
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      console.log("🧪 Creating HARDCODED test proposal via NEAR wallet...");

      const testMetadata = {
        title: "Demo: Fund Community Tooling Sprint",
        description:
          "This is a hardcoded test proposal to validate the end-to-end submission flow.",
        link: "https://forum.near.org/t/example-thread",
        voting_options: ["Approve", "Reject", "Abstain"],
      };

      console.log("📤 Creating proposal with metadata:", testMetadata);

      const txResult = await near.sendTx({
        receiverId: Constants.VOTING_CONTRACT_ID,
        actions: [
          near.actions.functionCall({
            methodName: "create_proposal",
            gas: $$`100 Tgas`,
            deposit: $$`0.2 NEAR`,
            args: { metadata: testMetadata },
          }),
        ],
        waitUntil: "INCLUDED",
      });

      console.log("✅ Hardcoded proposal TX:", txResult);

      setTestResult({
        success: true,
        type: "proposal-creation",
        txHash: txResult.transaction?.hash,
        message:
          "✅ Hardcoded test proposal created successfully! The agent should now detect and process it.",
        metadata: testMetadata,
        timestamp: new Date().toLocaleString(),
      });

      // Refresh proposals and agent data
      setTimeout(() => {
        refetch();
        fetchAllAgentData();
      }, 3000);
    } catch (error) {
      console.error("❌ Test proposal creation failed:", error);
      setTestResult({
        success: false,
        type: "proposal-creation",
        error: error.message,
        timestamp: new Date().toLocaleString(),
      });
    } finally {
      setTestLoading(false);
    }
  };

  // Debug agent configuration
  const debugAgentConfig = async () => {
    setTestLoading(true);

    try {
      console.clear();
      console.log("🔍 Starting comprehensive agent debug...");

      // Fetch all debug endpoints
      const [healthResp, agentStatusResp, websocketResp, anthropicResp] =
        await Promise.all([
          fetch(`${Constants.API_URL}/`),
          fetch(`${Constants.API_URL}/api/screener/agent-status`),
          fetch(`${Constants.API_URL}/api/debug/websocket-status`),
          fetch(`${Constants.API_URL}/debug/env`),
        ]);

      const [health, agentStatus, websocket, anthropic] = await Promise.all([
        healthResp.json(),
        agentStatusResp.json(),
        websocketResp.json(),
        anthropicResp.json(),
      ]);

      console.log("🏥 Health Check:", health);
      console.log("🤖 Agent Status:", agentStatus);
      console.log("🔌 WebSocket Status:", websocket);
      console.log("🧠 Anthropic Config:", anthropic);

      // Analyze results
      const issues = [];
      const successes = [];

      // Check health
      if (health.shadeAgent === "active") {
        successes.push("✅ Shade agent service active");
      } else {
        issues.push("❌ Shade agent service not active");
      }

      // Check WebSocket
      if (websocket.connected) {
        successes.push("✅ WebSocket connected for proposal monitoring");
      } else {
        issues.push(
          "❌ WebSocket not connected - proposals won't be auto-detected"
        );
      }

      // Check agent contract
      if (agentStatus.agentContract?.agentRegistered) {
        successes.push("✅ Agent registered with contract");
      } else {
        issues.push("❌ Agent not registered with contract");
      }

      // Check Anthropic API
      if (anthropic.hasAnthropicKey) {
        successes.push("✅ Anthropic API key configured");
      } else {
        issues.push("❌ Anthropic API key missing");
      }

      // Check auto-approval
      if (agentStatus.autoApproval?.enabled) {
        successes.push("✅ Auto-approval enabled");
      } else {
        issues.push("❌ Auto-approval disabled");
      }

      const summary = `
🔍 SHADE AGENT DEBUG REPORT

${successes.length > 0 ? "✅ WORKING:\n" + successes.join("\n") + "\n\n" : ""}${
        issues.length > 0 ? "❌ ISSUES:\n" + issues.join("\n") + "\n\n" : ""
      }📊 STATISTICS:
• Proposals Screened: ${health.screener?.totalScreened || 0}
• Successful Executions: ${autoApprovalStats?.autoApproval?.executed || 0}
• Failed Executions: ${autoApprovalStats?.autoApproval?.executionFailed || 0}

🔌 MONITORING:
• WebSocket: ${websocket.connected ? "Connected" : "Disconnected"}
• Voting Contract: ${websocket.votingContract}
• Reconnect Attempts: ${websocket.reconnectAttempts}

🤖 AGENT CONTRACT:
• Contract ID: ${agentStatus.agentContract?.contractId}
• Agent Registered: ${agentStatus.agentContract?.agentRegistered ? "Yes" : "No"}
• Contract Balance: ${agentStatus.agentContract?.contractBalance || "Unknown"}

🛡️ SECURITY:
• TEE Attestation: ${
        agentStatus.securityFeatures?.attestationRequired
          ? "Required"
          : "Not Required"
      }
• Codehash Validation: ${
        agentStatus.securityFeatures?.codehashValidation ? "Active" : "Inactive"
      }
• Access Control: ${agentStatus.securityFeatures?.accessControl || "Unknown"}

${
  issues.length === 0
    ? "🎉 ALL SYSTEMS OPERATIONAL!"
    : "⚠️ ISSUES DETECTED - CHECK CONFIGURATION"
}
      `.trim();

      alert(summary);
      console.log(summary);
    } catch (error) {
      const errorMsg = `❌ Debug failed: ${error.message}`;
      console.error(errorMsg);
      alert(errorMsg);
    } finally {
      setTestLoading(false);
    }
  };

  // Force process a specific proposal
  const forceProcessProposal = async () => {
    const proposalId = prompt("Enter proposal ID to force process:", "1");
    if (!proposalId) return;

    setTestLoading(true);
    try {
      const response = await fetch(`${Constants.API_URL}/process-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(
          `✅ Proposal ${proposalId} processed!\n\nApproved: ${
            result.approved
          }\nExecuted: ${result.executed}\nReasons: ${result.reasons?.join(
            ", "
          )}`
        );
      } else {
        alert(`❌ Processing failed: ${result.error}`);
      }

      fetchAllAgentData();
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  // Create lookup for execution results by proposal ID
  const executionLookup = useMemo(() => {
    const lookup = {};
    executionHistory.forEach((execution) => {
      lookup[execution.proposalId] = execution;
    });
    return lookup;
  }, [executionHistory]);

  // Filter proposals by status
  const filteredProposals = useMemo(() => {
    if (statusFilter === "all") return proposals;
    if (statusFilter === "agent-processed") {
      return proposals.filter((p) => executionLookup[p.id]);
    }
    if (statusFilter === "agent-approved") {
      return proposals.filter((p) => executionLookup[p.id]?.success === true);
    }
    if (statusFilter === "agent-failed") {
      return proposals.filter((p) => executionLookup[p.id]?.success === false);
    }

    const statusMap = {
      active: ["Voting"],
      pending: ["Created"],
      finished: ["Finished", "Approved", "Rejected"],
    };

    return proposals.filter((proposal) =>
      statusMap[statusFilter]?.includes(proposal.status)
    );
  }, [proposals, statusFilter, executionLookup]);

  // Pagination
  const totalPages = Math.ceil(filteredProposals.length / PROPOSALS_PER_PAGE);
  const startIndex = (currentPage - 1) * PROPOSALS_PER_PAGE;
  const paginatedProposals = filteredProposals.slice(
    startIndex,
    startIndex + PROPOSALS_PER_PAGE
  );

  // Get counts for each status
  const statusCounts = useMemo(() => {
    const agentProcessed = proposals.filter(
      (p) => executionLookup[p.id]
    ).length;
    const agentApproved = proposals.filter(
      (p) => executionLookup[p.id]?.success === true
    ).length;
    const agentFailed = proposals.filter(
      (p) => executionLookup[p.id]?.success === false
    ).length;

    return {
      all: proposals.length,
      active: proposals.filter((p) => p.status === "Voting").length,
      pending: proposals.filter((p) => p.status === "Created").length,
      finished: proposals.filter((p) =>
        ["Finished", "Approved", "Rejected"].includes(p.status)
      ).length,
      "agent-processed": agentProcessed,
      "agent-approved": agentApproved,
      "agent-failed": agentFailed,
    };
  }, [proposals, executionLookup]);

  const handleFilterChange = (newFilter) => {
    setStatusFilter(newFilter);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRefreshAll = () => {
    refetch();
    fetchAllAgentData();
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading proposals...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="panel">
        {/* Header with Real-Time Agent Status */}
        <div className="mb-4">
          <div className="row">
            <div className="col-md-8">
              <h2 className="mb-1">🤖 Autonomous Governance Agent</h2>

              {/* Real-time status */}
              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="card border-primary">
                    <div className="card-body py-2">
                      <h6 className="card-title mb-1">📊 Live Statistics</h6>
                      <div className="row text-center">
                        <div className="col-4">
                          <div className="h5 text-primary mb-0">
                            {autoApprovalStats?.autoApproval?.totalScreened ||
                              0}
                          </div>
                          <small>Screened</small>
                        </div>
                        <div className="col-4">
                          <div className="h5 text-success mb-0">
                            {autoApprovalStats?.autoApproval?.executed || 0}
                          </div>
                          <small>Approved</small>
                        </div>
                        <div className="col-4">
                          <div className="h5 text-danger mb-0">
                            {autoApprovalStats?.autoApproval?.executionFailed ||
                              0}
                          </div>
                          <small>Failed</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card border-success">
                    <div className="card-body py-2">
                      <h6 className="card-title mb-1">🔌 Connection Status</h6>
                      <div className="d-flex justify-content-between align-items-center">
                        <span>WebSocket:</span>
                        <span
                          className={`badge ${
                            autoApprovalStats?.monitoring?.eventStreamConnected
                              ? "bg-success"
                              : "bg-danger"
                          }`}
                        >
                          {autoApprovalStats?.monitoring?.eventStreamConnected
                            ? "Connected"
                            : "Disconnected"}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span>Agent:</span>
                        <span
                          className={`badge ${
                            agentStatus?.agentContract?.agentRegistered
                              ? "bg-success"
                              : "bg-warning"
                          }`}
                        >
                          {agentStatus?.agentContract?.agentRegistered
                            ? "Registered"
                            : "Not Registered"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Test Buttons */}
          <div className="d-flex gap-2 flex-wrap">
            <button
              className="btn btn-warning btn-sm"
              onClick={createTestProposal}
              disabled={testLoading || !accountId}
              title={!accountId ? "Sign in required" : "Create a test proposal"}
            >
              {testLoading ? "🔄 Creating..." : "🧪 Quick Test"}
            </button>

            <button
              className="btn btn-outline-primary btn-sm"
              onClick={testAgentApproval}
              disabled={testLoading}
              title="Test agent contract approval functionality"
            >
              {testLoading ? "🔄 Testing..." : "🚀 Test Agent Approval"}
            </button>

            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={forceProcessProposal}
              disabled={testLoading}
              title="Force process a specific proposal ID"
            >
              {testLoading ? "🔄 Processing..." : "⚡ Force Process"}
            </button>

            <button
              className="btn btn-outline-info btn-sm"
              onClick={debugAgentConfig}
              disabled={testLoading}
              title="Comprehensive agent configuration check"
            >
              {testLoading ? "🔄 Checking..." : "🔍 Debug Config"}
            </button>

            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleRefreshAll}
              disabled={loading}
              title="Refresh all data"
            >
              ♻️ Refresh
            </button>
          </div>
        </div>

        {/* Test Results Display */}
        {testResult && (
          <div
            className={`alert ${
              testResult.success ? "alert-success" : "alert-danger"
            } mb-4`}
          >
            <h6>
              🧪{" "}
              {testResult.type === "proposal-creation"
                ? "Proposal Creation"
                : testResult.type === "agent-approval"
                ? "Agent Approval"
                : "Test"}
              Results ({testResult.timestamp})
            </h6>

            {testResult.success ? (
              <div>
                <p>
                  <strong>✅ Success:</strong> {testResult.message}
                </p>
                {testResult.proposalId && (
                  <p>
                    <strong>📝 Proposal ID:</strong> {testResult.proposalId}
                  </p>
                )}
                {testResult.txHash && (
                  <p>
                    <strong>🔗 Transaction:</strong>
                    <code className="ms-1">{testResult.txHash}</code>
                  </p>
                )}
                {testResult.type === "proposal-creation" && (
                  <small className="text-success">
                    🎯 Monitor the console logs to see the agent automatically
                    detect, screen, and approve this proposal!
                  </small>
                )}
              </div>
            ) : (
              <div>
                <p>
                  <strong>❌ Error:</strong> {testResult.error}
                </p>
                {testResult.agentValid === false && (
                  <small className="text-danger">
                    The agent contract setup is invalid. Check the debug config
                    for details.
                  </small>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recent Activity */}
        {executionHistory.length > 0 && (
          <div className="alert alert-info mb-4">
            <h6>📋 Recent Agent Activity</h6>
            <div className="row">
              {executionHistory.slice(0, 3).map((execution, i) => (
                <div key={i} className="col-md-4">
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Proposal {execution.proposalId}</span>
                    <span
                      className={`badge ${
                        execution.success ? "bg-success" : "bg-danger"
                      }`}
                    >
                      {execution.success ? "✅ Approved" : "❌ Failed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <hr />

        {/* Error Message */}
        {error && (
          <div className="alert alert-danger mb-4">
            <h6>Error loading proposals:</h6>
            <p className="mb-0">{error}</p>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="mb-3">
          <ul className="nav nav-pills nav-fill">
            {[
              { key: "all", label: "All", count: statusCounts.all },
              { key: "pending", label: "Pending", count: statusCounts.pending },
              { key: "active", label: "Voting", count: statusCounts.active },
              {
                key: "agent-processed",
                label: "Agent Processed",
                count: statusCounts["agent-processed"],
              },
              {
                key: "agent-approved",
                label: "Agent Approved",
                count: statusCounts["agent-approved"],
              },
            ].map(({ key, label, count }) => (
              <li key={key} className="nav-item">
                <button
                  className={`nav-link ${statusFilter === key ? "active" : ""}`}
                  onClick={() => handleFilterChange(key)}
                >
                  {label}{" "}
                  {count > 0 && (
                    <span className="badge bg-secondary ms-1">{count}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Proposals List */}
        {filteredProposals.length === 0 ? (
          <div className="text-center py-5">
            <div className="text-muted">
              <h5>
                No {statusFilter === "all" ? "" : statusFilter} proposals found
              </h5>
              <p>
                {statusFilter === "active" &&
                  "No proposals are currently accepting votes."}
                {statusFilter === "pending" &&
                  "No proposals are awaiting review."}
                {statusFilter === "agent-processed" &&
                  "No proposals have been processed by the agent yet."}
                {statusFilter === "all" &&
                  "No proposals have been created yet. Create a test proposal to see the agent in action!"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              {paginatedProposals.map((proposal) => (
                <ProposalCard
                  key={`${proposal.contractId}-${proposal.id}`}
                  proposal={proposal}
                  compact={false}
                  agentExecution={executionLookup[proposal.id]}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="d-flex justify-content-center mt-4">
                <nav aria-label="Proposals pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li
                      className={`page-item ${
                        currentPage === 1 ? "disabled" : ""
                      }`}
                    >
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        &laquo; Previous
                      </button>
                    </li>

                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let page = i + 1;
                      if (totalPages > 5) {
                        if (currentPage <= 3) page = i + 1;
                        else if (currentPage >= totalPages - 2)
                          page = totalPages - 4 + i;
                        else page = currentPage - 2 + i;
                      }

                      return (
                        <li
                          key={page}
                          className={`page-item ${
                            currentPage === page ? "active" : ""
                          }`}
                        >
                          <button
                            className="page-link"
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </button>
                        </li>
                      );
                    })}

                    <li
                      className={`page-item ${
                        currentPage === totalPages ? "disabled" : ""
                      }`}
                    >
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next &raquo;
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}

            <div className="text-center text-muted small mt-3">
              Showing {startIndex + 1}-
              {Math.min(
                startIndex + PROPOSALS_PER_PAGE,
                filteredProposals.length
              )}{" "}
              of {filteredProposals.length} proposals
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Proposals;
