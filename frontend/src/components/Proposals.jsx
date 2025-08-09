import { useState, useMemo, useEffect } from "react";
import { useProposals } from "../hooks/useProposals.js";
import { ProposalCard } from "../components/ProposalCard.jsx";
import { Constants } from "../hooks/constants.js";

const PROPOSALS_PER_PAGE = 10;

export function Proposals({ accountId }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [screeningResults, setScreeningResults] = useState([]);
  const [agentStatus, setAgentStatus] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Get current proposals from voting contract
  const { proposals, loading, error, refetch } = useProposals(
    Constants.VOTING_CONTRACT_ID
  );

  // Fetch AI agent status and screening results
  useEffect(() => {
    fetchAgentStatus();
    fetchScreeningResults();
  }, []);

  const fetchAgentStatus = async () => {
    try {
      const response = await fetch(`${Constants.API_URL}/api/screener/status`);
      const data = await response.json();
      setAgentStatus(data);
    } catch (error) {
      console.error("Failed to fetch agent status:", error);
    }
  };

  const fetchScreeningResults = async () => {
    try {
      const response = await fetch(`${Constants.API_URL}/api/screener/results`);
      const data = await response.json();
      setScreeningResults(data.results || []);
    } catch (error) {
      console.error("Failed to fetch screening results:", error);
    }
  };

  // Test AI Agent Function
  // Replace your testAIAgent function with this version that uses hardcoded test data:

  const testAIAgent = async () => {
    setTestLoading(true);
    setTestResult(null);

    try {
      // Test 1: Check agent status
      const statusResponse = await fetch(
        `${Constants.API_URL}/api/screener/status`
      );
      const statusData = await statusResponse.json();

      // Test 2: Test connection
      const connectionResponse = await fetch(
        `${Constants.API_URL}/api/screener/test-connection`
      );
      const connectionData = await connectionResponse.json();

      // Test 3: Test proposal screening with hardcoded test data
      console.log("🧪 Testing AI screening with hardcoded proposal...");

      const testProposalData = {
        proposalId: "test-proposal-" + Date.now(), // Unique ID for testing
        proposal: {
          title: "Test Proposal: Allocate 1000 NEAR for Community Development",
          description:
            "This is a test proposal to allocate 1000 NEAR tokens for community development initiatives including hackathons, workshops, and developer grants. The funds will be managed by a community committee and distributed over 6 months.",
          proposer_id: "community-dev.testnet",
        },
      };

      console.log(
        "📤 Sending test proposal:",
        JSON.stringify(testProposalData, null, 2)
      );

      let screeningTest = null;
      try {
        const screeningResponse = await fetch(
          `${Constants.API_URL}/api/screener/screen`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(testProposalData),
          }
        );

        console.log("📡 Screening response status:", screeningResponse.status);
        console.log("📡 Screening response headers:", [
          ...screeningResponse.headers.entries(),
        ]);

        const responseText = await screeningResponse.text();
        console.log("📄 Screening response body:", responseText);

        if (screeningResponse.ok) {
          screeningTest = JSON.parse(responseText);
          console.log("✅ Screening test successful:", screeningTest);
        } else {
          console.error(
            `❌ Screening API error ${screeningResponse.status}:`,
            responseText
          );

          let errorMessage = responseText;
          try {
            const errorJson = JSON.parse(responseText);
            errorMessage = errorJson.error || errorJson.message || responseText;
          } catch {
            // Keep original response
          }

          screeningTest = {
            error: true,
            status: screeningResponse.status,
            message: errorMessage,
            proposalId: testProposalData.proposalId,
          };
        }
      } catch (screeningError) {
        console.error("❌ Screening request failed:", screeningError);
        screeningTest = {
          error: true,
          message: screeningError.message,
          proposalId: testProposalData.proposalId,
        };
      }

      setTestResult({
        success: true,
        status: statusData,
        connection: connectionData,
        screening: screeningTest,
        timestamp: new Date().toLocaleString(),
      });
    } catch (error) {
      console.error("❌ Test failed:", error);
      setTestResult({
        success: false,
        error: error.message,
        timestamp: new Date().toLocaleString(),
      });
    } finally {
      setTestLoading(false);
    }
  };

  // Create lookup for screening results by proposal ID
  const screeningLookup = useMemo(() => {
    const lookup = {};
    screeningResults.forEach((result) => {
      lookup[result.proposalId] = result;
    });
    return lookup;
  }, [screeningResults]);

  // Filter proposals by status
  const filteredProposals = useMemo(() => {
    if (statusFilter === "all") return proposals;
    if (statusFilter === "ai-screened") {
      return proposals.filter((p) => screeningLookup[p.id]);
    }
    if (statusFilter === "ai-approved") {
      return proposals.filter((p) => screeningLookup[p.id]?.approved === true);
    }
    if (statusFilter === "ai-rejected") {
      return proposals.filter((p) => screeningLookup[p.id]?.approved === false);
    }

    const statusMap = {
      active: ["Voting"],
      pending: ["Created"],
      finished: ["Finished", "Approved", "Rejected"],
    };

    return proposals.filter((proposal) =>
      statusMap[statusFilter]?.includes(proposal.status)
    );
  }, [proposals, statusFilter, screeningLookup]);

  // Pagination
  const totalPages = Math.ceil(filteredProposals.length / PROPOSALS_PER_PAGE);
  const startIndex = (currentPage - 1) * PROPOSALS_PER_PAGE;
  const paginatedProposals = filteredProposals.slice(
    startIndex,
    startIndex + PROPOSALS_PER_PAGE
  );

  // Get counts for each status
  const statusCounts = useMemo(() => {
    const aiScreened = proposals.filter((p) => screeningLookup[p.id]).length;
    const aiApproved = proposals.filter(
      (p) => screeningLookup[p.id]?.approved === true
    ).length;
    const aiRejected = proposals.filter(
      (p) => screeningLookup[p.id]?.approved === false
    ).length;

    return {
      all: proposals.length,
      active: proposals.filter((p) => p.status === "Voting").length,
      pending: proposals.filter((p) => p.status === "Created").length,
      finished: proposals.filter((p) =>
        ["Finished", "Approved", "Rejected"].includes(p.status)
      ).length,
      "ai-screened": aiScreened,
      "ai-approved": aiApproved,
      "ai-rejected": aiRejected,
    };
  }, [proposals, screeningLookup]);

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
    fetchAgentStatus();
    fetchScreeningResults();
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
        {/* Header with AI Agent Status */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="mb-1">📋 Proposals with AI Governance</h2>
            <p className="text-muted mb-0">
              Voting Contract: <code>{Constants.VOTING_CONTRACT_ID}</code>
            </p>
            {agentStatus && (
              <div className="mt-1">
                <small
                  className={`text-${
                    agentStatus.autonomousMode ? "success" : "warning"
                  }`}
                >
                  🤖 AI Agent:{" "}
                  {agentStatus.autonomousMode
                    ? "Active & Autonomous"
                    : "Monitoring Only"}{" "}
                  | Agent: <code>{agentStatus.agentAccount}</code> | Screened:{" "}
                  {agentStatus.totalScreened}
                </small>
              </div>
            )}
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-success btn-sm"
              onClick={testAIAgent}
              disabled={testLoading}
            >
              {testLoading ? "🔄 Testing..." : "🧪 Test AI Agent"}
            </button>
            <button
              className="btn btn-warning btn-sm"
              onClick={async () => {
                console.clear();
                console.log("🔍 Starting API Debug...");

                // Check API debug endpoint
                try {
                  const debugResponse = await fetch(
                    `${Constants.API_URL}/api/screener/debug`
                  );
                  if (debugResponse.ok) {
                    const debugData = await debugResponse.json();
                    console.log("🔧 API Configuration:", debugData);
                  } else {
                    console.error(
                      "Debug endpoint failed:",
                      debugResponse.status,
                      debugResponse.statusText
                    );
                  }
                } catch (error) {
                  console.error("Debug endpoint failed:", error);
                }

                // Test screening endpoint manually
                try {
                  console.log("🧪 Testing screening endpoint...");

                  const testData = {
                    proposalId: "debug-test",
                    proposal: {
                      title: "Debug Test Proposal",
                      description: "Testing from frontend debug button",
                      proposer_id: "debug.testnet",
                    },
                  };

                  console.log("📤 Sending:", testData);

                  const response = await fetch(
                    `${Constants.API_URL}/api/screener/screen`,
                    {
                      method: "POST",
                      headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                      },
                      mode: "cors",
                      body: JSON.stringify(testData),
                    }
                  );

                  console.log("📡 Response status:", response.status);
                  console.log(
                    "📡 Response headers:",
                    Object.fromEntries(response.headers)
                  );

                  const responseText = await response.text();
                  console.log("📄 Response body:", responseText);

                  if (response.ok) {
                    try {
                      const parsed = JSON.parse(responseText);
                      console.log("✅ Parsed response:", parsed);
                      alert(
                        `✅ Screening worked! Result: ${
                          parsed.approved ? "APPROVED" : "REJECTED"
                        }\nReasons: ${
                          parsed.reasons?.join(", ") || "No reasons provided"
                        }`
                      );
                    } catch (parseError) {
                      console.error("❌ Failed to parse response:", parseError);
                      alert(
                        `❌ Got response but couldn't parse JSON: ${responseText.substring(
                          0,
                          200
                        )}`
                      );
                    }
                  } else {
                    console.error("❌ Screening failed");

                    // Try to parse error response
                    let errorMessage = responseText;
                    try {
                      const errorJson = JSON.parse(responseText);
                      errorMessage =
                        errorJson.error || errorJson.message || responseText;
                    } catch {
                      // Keep original response text
                    }

                    alert(
                      `❌ API Error ${
                        response.status
                      }: ${errorMessage.substring(0, 200)}`
                    );
                  }
                } catch (error) {
                  console.error("❌ Request failed:", error);
                  alert(`❌ Request failed: ${error.message}`);
                }
              }}
            >
              🔍 Debug API
            </button>

            <button
              className="btn btn-info btn-sm"
              onClick={async () => {
                try {
                  const envResponse = await fetch(
                    `${Constants.API_URL}/api/screener/debug`
                  );
                  if (envResponse.ok) {
                    const envData = await envResponse.json();
                    console.log("🔧 Environment Check:", envData);

                    const issues = [];

                    // Check environment variables
                    if (envData.environment?.AGENT_ACCOUNT_ID === "❌ Missing")
                      issues.push("Missing AGENT_ACCOUNT_ID");
                    if (
                      envData.environment?.VOTING_CONTRACT_ID === "❌ Missing"
                    )
                      issues.push("Missing VOTING_CONTRACT_ID");
                    if (envData.environment?.ANTHROPIC_API_KEY !== "✅ Set")
                      issues.push("Missing ANTHROPIC_API_KEY");

                    // Check screener config
                    if (!envData.screenerConfig?.agentAccountId)
                      issues.push("Screener missing agentAccountId");
                    if (!envData.screenerConfig?.votingContractId)
                      issues.push("Screener missing votingContractId");

                    // Check overall configuration
                    if (!envData.isConfigured)
                      issues.push(
                        "Screener not configured for autonomous mode"
                      );

                    if (issues.length > 0) {
                      alert(
                        `⚠️ Configuration Issues Found:\n\n${issues.join(
                          "\n"
                        )}\n\n` +
                          `Current Status:\n` +
                          `- Autonomous Mode: ${
                            envData.screenerConfig?.autonomousMode
                              ? "✅ Active"
                              : "❌ Disabled"
                          }\n` +
                          `- Agent: ${
                            envData.screenerConfig?.agentAccountId ||
                            "❌ Missing"
                          }\n` +
                          `- Contract: ${
                            envData.screenerConfig?.votingContractId ||
                            "❌ Missing"
                          }\n` +
                          `- API Key: ${
                            envData.environment?.ANTHROPIC_API_KEY ||
                            "❌ Missing"
                          }\n\n` +
                          `Check your .env.development.local file and restart server!`
                      );
                    } else {
                      alert(
                        `✅ Configuration Looks Good!\n\n` +
                          `✅ Autonomous Mode: Active\n` +
                          `✅ Agent: ${envData.screenerConfig.agentAccountId}\n` +
                          `✅ Contract: ${envData.screenerConfig.votingContractId}\n` +
                          `✅ API Key: Configured\n\n` +
                          `🚀 AI agent ready for action!`
                      );
                    }
                  }
                } catch (error) {
                  alert(`❌ Could not check configuration: ${error.message}`);
                }
              }}
            >
              🔧 Check Config
            </button>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={handleRefreshAll}
              disabled={loading}
            >
              🔄 Refresh
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
            <h6>🧪 AI Agent Test Results ({testResult.timestamp})</h6>
            {testResult.success ? (
              <div>
                <p>
                  <strong>✅ Agent Status:</strong>{" "}
                  {testResult.status?.autonomousMode
                    ? "Autonomous"
                    : "Monitor Only"}{" "}
                  | Total Screened: {testResult.status?.totalScreened || 0}
                </p>
                <p>
                  <strong>✅ Connection:</strong>{" "}
                  {testResult.connection?.success ? "Connected" : "Failed"}
                </p>
                {testResult.screening && (
                  <p>
                    <strong>✅ Screening Test:</strong> Proposal #
                    {testResult.screening.proposalId} -
                    {testResult.screening.error ? (
                      <span className="text-danger">
                        ERROR: {testResult.screening.message}
                      </span>
                    ) : (
                      <>
                        {testResult.screening.approved
                          ? "APPROVED"
                          : "REJECTED"}{" "}
                        | Reasons:{" "}
                        {testResult.screening.reasons?.join(", ") ||
                          "No reasons provided"}
                      </>
                    )}
                  </p>
                )}
                <small className="text-success">
                  🎉{" "}
                  {testResult.screening?.error
                    ? "Tests completed with some errors"
                    : "All systems operational!"}
                </small>
              </div>
            ) : (
              <div>
                <p>
                  <strong>❌ Test Failed:</strong> {testResult.error}
                </p>
                <small>
                  Check your network connection and agent deployment.
                </small>
              </div>
            )}
          </div>
        )}

        {/* Filter Buttons with AI Filters */}
        <div className="d-flex flex-wrap gap-2 mb-4">
          <button
            className={`btn ${
              statusFilter === "all" ? "btn-primary" : "btn-outline-primary"
            } btn-sm`}
            onClick={() => handleFilterChange("all")}
          >
            All ({statusCounts.all})
          </button>
          <button
            className={`btn ${
              statusFilter === "ai-screened" ? "btn-info" : "btn-outline-info"
            } btn-sm`}
            onClick={() => handleFilterChange("ai-screened")}
          >
            🤖 AI Screened ({statusCounts["ai-screened"]})
          </button>
          <button
            className={`btn ${
              statusFilter === "ai-approved"
                ? "btn-success"
                : "btn-outline-success"
            } btn-sm`}
            onClick={() => handleFilterChange("ai-approved")}
          >
            🤖✅ Approved ({statusCounts["ai-approved"]})
          </button>
          <button
            className={`btn ${
              statusFilter === "ai-rejected"
                ? "btn-danger"
                : "btn-outline-danger"
            } btn-sm`}
            onClick={() => handleFilterChange("ai-rejected")}
          >
            🤖❌ Rejected ({statusCounts["ai-rejected"]})
          </button>
          <button
            className={`btn ${
              statusFilter === "active" ? "btn-success" : "btn-outline-success"
            } btn-sm`}
            onClick={() => handleFilterChange("active")}
          >
            🗳️ Active ({statusCounts.active})
          </button>
          <button
            className={`btn ${
              statusFilter === "pending" ? "btn-warning" : "btn-outline-warning"
            } btn-sm`}
            onClick={() => handleFilterChange("pending")}
          >
            ⏳ Pending ({statusCounts.pending})
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="alert alert-danger mb-4">
            <h6>Error loading proposals:</h6>
            <p className="mb-0">{error}</p>
          </div>
        )}

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
                {statusFilter === "ai-screened" &&
                  "No proposals have been screened by AI yet."}
                {statusFilter === "all" &&
                  "No proposals have been created yet. Be the first to submit one!"}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Proposals */}
            <div className="mb-4">
              {paginatedProposals.map((proposal) => (
                <ProposalCard
                  key={`${proposal.contractId}-${proposal.id}`}
                  proposal={proposal}
                  compact={false}
                  screeningResult={screeningLookup[proposal.id]}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="d-flex justify-content-center">
                <nav aria-label="Proposals pagination">
                  <ul className="pagination pagination-sm">
                    {currentPage > 1 && (
                      <li className="page-item">
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(currentPage - 1)}
                        >
                          Previous
                        </button>
                      </li>
                    )}

                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let page;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
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

                    {currentPage < totalPages && (
                      <li className="page-item">
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(currentPage + 1)}
                        >
                          Next
                        </button>
                      </li>
                    )}
                  </ul>
                </nav>
              </div>
            )}

            <div className="text-center text-muted small">
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
