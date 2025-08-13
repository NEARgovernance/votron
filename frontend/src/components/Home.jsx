import { useState, useEffect } from "react";
import { near } from "../hooks/fastnear.js";
import { Connect } from "./Connect.jsx";
import { Proposals } from "./Proposals.jsx";
import { Status } from "./Status.jsx";
import { Constants } from "../hooks/constants.js";

export function Home({ accountId }) {
  const [agentStatus, setAgentStatus] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecutionLoading, setIsExecutionLoading] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Status
  const wsConnected = !!stats?.monitoring?.eventStreamConnected;
  const agentRegistered = !!agentStatus?.agentContract?.agentRegistered;

  // Fetch agent data
  useEffect(() => {
    fetchAllAgentData();

    // Refresh every 5 seconds
    const interval = setInterval(fetchAllAgentData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllAgentData = async () => {
    try {
      await Promise.all([
        fetchAgentStatus(),
        fetchStats(),
        fetchExecutionHistory(),
      ]);
    } catch (error) {
      console.error("Failed to fetch agent data:", error);
    }
  };

  const fetchAgentStatus = async () => {
    try {
      const response = await fetch(`${Constants.API_URL}/api/agent-status`);
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

  const fetchStats = async () => {
    try {
      const response = await fetch(`${Constants.API_URL}/api/screener/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchExecutionHistory = async () => {
    try {
      const response = await fetch(`${Constants.API_URL}/api/screener/history`);
      if (response.ok) {
        const data = await response.json();
        setExecutionHistory(data.history || []);
      }
    } catch (error) {
      console.error("Failed to fetch execution history:", error);
    }
  };

  const createTestProposal = async () => {
    if (!accountId) {
      alert("Please sign in to create a proposal.");
      return;
    }

    try {
      const defaultMetadata = {
        title:
          "NEAR Developer Education Platform: Comprehensive Tutorial Series",
        description: `
**Project Overview:**
Create a comprehensive educational platform with video tutorials, hands-on workshops, and interactive coding examples to onboard new developers to the NEAR ecosystem.

**Specific Deliverables:**
1. 20 high-quality video tutorials (15-30 minutes each) covering:
   - NEAR fundamentals and account model
   - Smart contract development with Rust
   - Frontend integration with near-api-js
   - Cross-contract calls and complex workflows
   - Testing and deployment best practices

2. Interactive coding playground with 15 pre-built examples
3. 4 live workshop sessions (2 hours each) with Q&A
4. Comprehensive documentation and code repositories
5. Developer certification program with completion badges

**Timeline:** 3 months
- Month 1: Content planning and first 8 tutorials
- Month 2: Remaining tutorials and interactive examples
- Month 3: Live workshops and platform polish

**Budget Breakdown:**
- Video production and editing: $8,000
- Platform development: $5,000
- Workshop hosting and coordination: $2,000
- Documentation and testing: $3,000
- Marketing and outreach: $2,000
**Total: $20,000**

**Team Qualifications:**
- Lead developer with 3+ years Rust experience
- Educational content creator with 50K+ YouTube subscribers
- Previous NEAR grant recipient with proven delivery record

**Success Metrics:**
- 500+ developers complete at least 5 tutorials
- 100+ developers earn certification
- 50+ new smart contracts deployed by graduates
- 4.5+ star average rating from participants

**Long-term Impact:**
This initiative will significantly expand NEAR's developer community, reduce onboarding friction, and create a sustainable education resource for future ecosystem growth.
  `,
        link: "https://near-dev-education.org",
        voting_options: ["Approve", "Reject"],
      };

      await near.sendTx({
        receiverId: Constants.VOTING_CONTRACT_ID,
        actions: [
          near.actions.functionCall({
            methodName: "create_proposal",
            gas: $$`100 Tgas`,
            deposit: $$`0.1 NEAR`,
            args: { metadata: defaultMetadata },
          }),
        ],
        waitUntil: "INCLUDED",
      });

      setTimeout(() => {
        fetchAllAgentData();
      }, 3000);
    } catch (error) {
      console.error("Failed to create proposal:", error);
    }
  };

  const testScreening = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      console.log("🤖 Testing AI screening...");

      const response = await fetch(
        `${Constants.API_URL}/api/screener/test-ai-screening`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposal: {
              title: "Test NEAR DeFi Protocol Development",
              description:
                "Building a new automated market maker (AMM) protocol for the NEAR ecosystem. Budget: $10,000 for 3 months of development. Our team has previous DeFi experience with Uniswap and PancakeSwap. The protocol will feature low slippage, multi-token pools, and yield farming capabilities.",
              proposer_id: "developer.testnet",
            },
          }),
        }
      );

      const result = await response.json();
      setTestResult(result);

      console.log("🤖 AI Test Result:", result);

      if (result.success) {
        const decision = result.aiDecision.approved ? "APPROVED" : "REJECTED";
        alert(
          `✅ AI Test Complete!\n\nDecision: ${decision}\n\nReasons:\n${result.aiDecision.reasons.join(
            "\n"
          )}`
        );
      } else {
        alert(`❌ AI Test Failed: ${result.error}`);
      }
    } catch (error) {
      console.error("AI test failed:", error);
      const errorResult = { success: false, error: error.message };
      setTestResult(errorResult);
      alert(`❌ Test Failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testExecution = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      console.log("🚀 Testing execution...");

      const response = await fetch(
        `${Constants.API_URL}/api/screener/test-execute-approved`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();
      setTestResult(result);

      console.log("🚀 Execution Test Result:", result);

      if (result.success) {
        const summary = `✅ Execution Test Complete!

Proposal ID: ${result.proposalId}
Execution: ${result.execution.action.toUpperCase()}
Mode: ${result.mode}
${
  result.execution.transactionHash
    ? `Transaction: ${result.execution.transactionHash.substring(0, 20)}...`
    : ""
}`;

        alert(summary);
      } else {
        let errorMsg = `❌ Execution Test Failed: ${result.error}`;
        if (result.suggestion) {
          errorMsg += `\n\nSuggestion: ${result.suggestion}`;
        }
        alert(errorMsg);
      }
    } catch (error) {
      console.error("Execution test failed:", error);
      const errorResult = { success: false, error: error.message };
      setTestResult(errorResult);
      alert(`❌ Test Failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const checkTestStatus = async () => {
    try {
      const response = await fetch(
        `${Constants.API_URL}/api/screener/test-status`
      );
      const result = await response.json();

      console.log("🧪 Test Status:", result);

      const summary = `🧪 Test Status Report

AI Testing: ${result.ready.aiTesting ? "✅ Ready" : "❌ Not Ready"}
Execution Testing: ${
        result.ready.executionTesting ? "✅ Ready" : "❌ Not Ready"
      }

Proposals:
- Total: ${result.proposals.total}
- Approved: ${result.proposals.approved}
- Available for Execution: ${result.proposals.approvedUnexecuted}
- Already Executed: ${result.proposals.executed}

Agent Mode: ${result.agentConfig.mode}`;

      alert(summary);
    } catch (error) {
      console.error("Failed to check test status:", error);
      alert(`❌ Failed to check test status: ${error.message}`);
    }
  };

  return (
    <div className="container-fluid">
      <div className="panel">
        {/* Header */}
        <div className="mb-4">
          <div className="mb-2">
            <h2 className="mb-0">🤖 Votron</h2>
          </div>
          <div className="mb-1">
            <h3>Autonomous Reviewer</h3>
          </div>

          {/* Real-time status */}
          <div className="row mb-4">
            <div className="d-flex align-items-center p-3 mb-1">
              <span>
                {wsConnected ? (
                  <>
                    🟢 <b>WebSocket:</b> Connected
                  </>
                ) : (
                  <>
                    🔴 <b>WebSocket:</b> Not Connected
                  </>
                )}
              </span>
            </div>

            <div className="d-flex align-items-center p-3">
              <span>
                {agentRegistered ? (
                  <>
                    ☑️ <b>Agent:</b> Registered
                  </>
                ) : (
                  <>
                    ⚠️ <b>Agent:</b> Not Registered
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Buttons for Testing */}
          <div className="d-flex gap-2 flex-wrap">
            <Connect accountId={accountId} />
            <button
              className="btn btn-success btn-sm"
              style={{ minWidth: "140px" }}
              onClick={createTestProposal}
              disabled={testLoading || !accountId}
              title={!accountId ? "Sign in required" : "Create a proposal"}
            >
              {testLoading ? "🔄 Creating..." : "📝 Create Proposal"}
            </button>
            <button
              className="btn btn-outline-primary btn-sm"
              style={{ minWidth: "140px" }}
              onClick={testScreening}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Testing...
                </>
              ) : (
                <>🤖 Test Decision</>
              )}
            </button>
            <button
              className="btn btn-outline-success btn-sm"
              style={{ minWidth: "140px" }}
              onClick={testExecution}
              disabled={isExecutionLoading}
            >
              {isExecutionLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Executing...
                </>
              ) : (
                <>🚀 Test Approval</>
              )}
            </button>

            <button
              className="btn btn-outline-info btn-sm"
              style={{ minWidth: "140px" }}
              onClick={checkTestStatus}
              disabled={isStatusLoading}
            >
              🧪 Test Status
            </button>
          </div>
        </div>

        {/* Test Results */}
        {testResult && (
          <div
            className={`mt-3 p-3 rounded ${
              testResult.success
                ? "bg-light border-success"
                : "bg-light border-danger"
            }`}
          >
            <h6 className={testResult.success ? "text-success" : "text-danger"}>
              {testResult.success ? "✅" : "❌"} Test Result:{" "}
              {testResult.testType}
            </h6>

            {testResult.success &&
              testResult.testType === "ai_screening_only" && (
                <div>
                  <p>
                    <strong>AI Decision:</strong>
                    <span
                      className={
                        testResult.aiDecision.approved
                          ? "text-success"
                          : "text-warning"
                      }
                    >
                      {testResult.aiDecision.approved
                        ? " APPROVED"
                        : " REJECTED"}
                    </span>
                  </p>
                  <small>
                    Reasons: {testResult.aiDecision.reasons.join(", ")}
                  </small>
                </div>
              )}

            {testResult.success && testResult.testType === "execution_test" && (
              <div>
                <p>
                  <strong>Proposal:</strong> {testResult.proposalId}
                </p>
                <p>
                  <strong>Result:</strong>{" "}
                  {testResult.execution.action.toUpperCase()}
                </p>
                {testResult.execution.transactionHash && (
                  <small>
                    TX: {testResult.execution.transactionHash.substring(0, 20)}
                    ...
                  </small>
                )}
              </div>
            )}

            {!testResult.success && (
              <p className="text-danger">{testResult.error}</p>
            )}
          </div>
        )}

        {/* Workflow Tracking */}
        <div className="mb-5">
          <h3>Shade Agent Workflow</h3>
          <Status />
        </div>

        {/* List of All Proposals */}
        <div className="mb-4">
          <Proposals
            accountId={accountId}
            executionHistory={executionHistory}
            onRefreshAgent={fetchAllAgentData}
          />
        </div>
      </div>
    </div>
  );
}

export default Home;
