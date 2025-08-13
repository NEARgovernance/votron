import { Hono } from "hono";
import { agent, agentAccountId, agentInfo } from "@neardefi/shade-agent-js";
import {
  ProposalScreener,
  ScreeningResult,
  ExecutionResult,
  ExecutionStatus,
} from "../proposalScreener";

const routes = new Hono();

export default function createScreenerRoutes(screener: ProposalScreener) {
  // Main screening endpoint
  routes.post("/screen", async (c) => {
    try {
      const { proposalId, proposal } = await c.req.json();

      if (!proposalId || !proposal) {
        return c.json({ error: "proposalId and proposal required" }, 400);
      }

      const result = await screener.screenProposal(proposalId, proposal);

      return c.json({
        proposalId,
        approved: result.approved,
        reasons: result.reasons,
        executed: !!result.executionResult,
        transactionHash: result.executionResult?.transactionHash,
        timestamp: result.timestamp,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return c.json({ error: errorMessage }, 500);
    }
  });

  routes.get("/status/:proposalId", (c) => {
    const proposalId = c.req.param("proposalId");
    const screeningResult = screener.getScreeningResult(proposalId);
    const executionStatus = screener.getExecutionStatus(proposalId);

    if (!screeningResult) {
      return c.json({
        proposalId,
        screened: false,
        message: "Proposal not yet screened",
      });
    }

    return c.json({
      proposalId,
      screened: true,
      approved: screeningResult.approved,
      reasons: screeningResult.reasons,
      timestamp: screeningResult.timestamp,
      executed: !!executionStatus?.executed,
      executionResult: executionStatus,
    });
  });

  // Manual execution endpoint
  routes.post("/execute/:proposalId", async (c) => {
    try {
      const proposalId = c.req.param("proposalId");
      const { force } = await c.req.json().catch(() => ({ force: false }));

      // Check if proposal was screened and approved
      const screeningResult = screener.getScreeningResult(proposalId);
      if (!screeningResult && !force) {
        return c.json({ error: "Proposal not screened" }, 400);
      }

      if (!screeningResult?.approved && !force) {
        return c.json(
          {
            error: "Proposal was not approved. Use force=true to override.",
            screeningResult,
          },
          400
        );
      }

      // Check if already executed
      if (screener.isProposalExecuted(proposalId)) {
        const existingResult = screener.getExecutionStatus(proposalId);
        return c.json(
          {
            error: "Proposal already executed",
            execution: existingResult,
          },
          400
        );
      }

      const executionResult = await screener.approveProposal(proposalId);

      return c.json({
        success: true,
        proposalId,
        forced: !!force,
        execution: {
          transactionHash: executionResult.transactionHash,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Manual execution failed:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  // System status
  routes.get("/status", async (c) => {
    try {
      const screeningStats = screener.getScreeningHistory();
      const executionStats = screener.getExecutionStats();
      const approved = screeningStats.filter((r) => r.approved).length;
      const notApproved = screeningStats.length - approved;

      return c.json({
        autonomousMode: screener.autonomousMode,
        configured: !!(
          screener.votingContractId &&
          (screener.customContractId || screener.agentAccountId)
        ),
        agentAccount: screener.agentAccountId,
        customContract: screener.customContractId,
        mode: screener.customContractId ? "custom_contract" : "tee_fallback",
        screening: {
          totalScreened: screeningStats.length,
          breakdown: { approved, notApproved },
          lastScreened:
            screeningStats.length > 0
              ? screeningStats[screeningStats.length - 1].timestamp
              : null,
        },
        execution: {
          totalExecutions: executionStats.total,
          successful: executionStats.successful,
          failed: executionStats.failed,
          pending: executionStats.pending,
          lastExecution: executionStats.lastExecution,
        },
      });
    } catch (error) {
      return c.json({
        autonomousMode: screener.autonomousMode,
        configured: false,
        totalScreened: screener.getScreeningHistory().length,
        error: "Could not fetch complete status",
      });
    }
  });

  // Get screening results
  routes.get("/results", (c) => {
    const results = screener.getScreeningHistory();
    return c.json({
      results: results.map((r) => ({
        proposalId: r.proposalId,
        approved: r.approved,
        reasons: r.reasons,
        executed: screener.isProposalExecuted(r.proposalId),
        timestamp: r.timestamp,
      })),
    });
  });

  routes.post("/test-ai-screening", async (c) => {
    try {
      const requestBody = await c.req.json().catch(() => ({}));

      const testProposal = requestBody.proposal || {
        title: "Test NEAR DeFi Protocol Development",
        description:
          "Building a new automated market maker (AMM) protocol for the NEAR ecosystem. Budget: $10,000 for 3 months of development. Our team has previous DeFi experience.",
        proposer_id: "developer.testnet",
      };

      const proposalId = requestBody.proposalId || `ai-test-${Date.now()}`;

      // Call AI directly - much cleaner!
      const aiDecision = await screener.askAI(testProposal);

      return c.json({
        success: true,
        testType: "ai_screening_only",
        proposalId,
        proposal: testProposal,
        aiDecision,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        500
      );
    }
  });

  routes.post("/test-execute-approved", async (c) => {
    try {
      const requestBody = await c.req.json().catch(() => ({}));

      const screeningHistory = screener.getScreeningHistory();
      const approvedUnexecuted = screeningHistory.find(
        (result) =>
          result.approved && !screener.isProposalExecuted(result.proposalId)
      );

      if (!approvedUnexecuted) {
        return c.json(
          {
            success: false,
            testType: "execution_test",
            error: "No approved proposals available for execution",
            suggestion:
              "First run the AI screening test to get an approved proposal",
            availableProposals: {
              total: screeningHistory.length,
              approved: screeningHistory.filter((r) => r.approved).length,
              alreadyExecuted: screeningHistory.filter((r) =>
                screener.isProposalExecuted(r.proposalId)
              ).length,
            },
            timestamp: new Date().toISOString(),
          },
          400
        );
      }

      console.log(
        `🚀 Testing execution for approved proposal: ${approvedUnexecuted.proposalId}`
      );

      // Execute the approved proposal
      const executionResult = await screener.approveProposal(
        approvedUnexecuted.proposalId
      );

      return c.json({
        success: true,
        testType: "execution_test",
        proposalId: approvedUnexecuted.proposalId,
        originalApproval: {
          reasons: approvedUnexecuted.reasons,
          timestamp: approvedUnexecuted.timestamp,
        },
        execution: {
          action: executionResult.action,
          transactionHash: executionResult.transactionHash,
          timestamp: executionResult.timestamp,
          error: executionResult.error,
        },
        mode: screener.customContractId ? "agent_contract" : "tee_fallback",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Execution test failed:", error);
      return c.json(
        {
          success: false,
          testType: "execution_test",
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        500
      );
    }
  });

  routes.get("/test-status", (c) => {
    const screeningHistory = screener.getScreeningHistory();
    const approved = screeningHistory.filter((r) => r.approved);
    const approvedUnexecuted = approved.filter(
      (r) => !screener.isProposalExecuted(r.proposalId)
    );
    const executionStats = screener.getExecutionStats();

    return c.json({
      ready: {
        aiTesting: true, // Always ready
        executionTesting: approvedUnexecuted.length > 0,
      },
      proposals: {
        total: screeningHistory.length,
        approved: approved.length,
        approvedUnexecuted: approvedUnexecuted.length,
        executed: executionStats.successful,
      },
      availableForExecution: approvedUnexecuted.map((p) => ({
        proposalId: p.proposalId,
        approved: p.approved,
        reasons: p.reasons.slice(0, 2), // First 2 reasons
        timestamp: p.timestamp,
      })),
      agentConfig: {
        autonomousMode: screener.autonomousMode,
        agentAccountId: screener.agentAccountId,
        customContractId: screener.customContractId,
        mode: screener.customContractId ? "agent_contract" : "tee_fallback",
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Agent information
  routes.get("/agent-info", async (c) => {
    try {
      const accountInfo = await agentAccountId();
      const agentDetails = await agentInfo();

      return c.json({
        agentAccountId: accountInfo.accountId,
        agentInfo: agentDetails,
        configuredAccountId: screener.agentAccountId,
        votingContract: screener.votingContractId,
        customContract: screener.customContractId,
        mode: screener.customContractId ? "custom_contract" : "tee_fallback",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return c.json({ error: errorMessage }, 500);
    }
  });

  // Auto-approval stats endpoint
  routes.get("/stats", (c) => {
    const screeningHistory = screener.getScreeningHistory();
    const approved = screeningHistory.filter((r) => r.approved).length;
    const rejected = screeningHistory.length - approved;
    const recentExecutions = screener.getRecentExecutions(5);
    const executionStats = screener.getExecutionStats();

    const autoApprovalStats = {
      totalScreened: screeningHistory.length,
      approved,
      rejected,
      executed: executionStats.successful,
      executionFailed: executionStats.failed,
      pending: approved - executionStats.successful,
      lastActivity:
        screeningHistory.length > 0
          ? screeningHistory[screeningHistory.length - 1].timestamp
          : null,
      recentExecutions,
    };

    return c.json({
      autoApproval: autoApprovalStats,
      monitoring: {
        eventStreamConnected: true, // This is handled in index.ts
        isConnecting: false,
        reconnectAttempts: 0,
      },
    });
  });

  // Execution history
  routes.get("/history", (c) => {
    const history = screener.getRecentExecutions(10);
    const stats = screener.getExecutionStats();

    return c.json({
      history,
      totalExecutions: stats.total,
      successfulExecutions: stats.successful,
      failedExecutions: stats.failed,
    });
  });

  // Check agent balance
  routes.get("/balance", async (c) => {
    try {
      const balance = await agent("getBalance");
      const accountId = await agentAccountId();

      return c.json({
        agentAccount: accountId.accountId,
        balance: balance,
        balanceInNEAR: balance.available
          ? (
              BigInt(balance.available) / BigInt("1000000000000000000000000")
            ).toString()
          : "unknown",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return c.json(
        {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        500
      );
    }
  });

  // Clear history
  routes.delete("/history", (c) => {
    screener.clearHistory();
    return c.json({
      message: "History cleared",
      timestamp: new Date().toISOString(),
    });
  });

  return routes;
}
