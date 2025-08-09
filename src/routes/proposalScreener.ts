import { Hono } from "hono";
import { agent, agentAccountId, agentInfo } from "@neardefi/shade-agent-js";

const proposalScreener = new Hono();

interface Screener {
  screenProposal: (
    proposalId: string,
    proposal: any
  ) => Promise<{
    approved: boolean;
    reasons: string[];
    executionResult?: { transactionHash?: string };
    timestamp: string | number;
  }>;
  approveProposal: (
    proposalId: string
  ) => Promise<{ transactionHash?: string }>;
  getScreeningHistory: () => Array<{
    proposalId: string;
    approved: boolean;
    reasons: string[];
    executionResult?: { transactionHash?: string };
    timestamp: string | number;
  }>;
  autonomousMode: boolean;
  agentAccountId?: string;
  votingContractId?: string;
  customContractId?: string;
  testContractConnection?: () => Promise<boolean>;
}

export default function createScreenerRoutes(screener: Screener) {
  // Main screening endpoint
  proposalScreener.post("/screen", async (c) => {
    try {
      const { proposalId, proposal } = await c.req.json();

      if (!proposalId || !proposal) {
        return c.json({ error: "proposalId and proposal required" }, 400);
      }

      const result = await screener.screenProposal(proposalId, proposal);

      // Auto-execute if configured
      if (screener.autonomousMode && result.approved) {
        try {
          await screener.approveProposal(proposalId);
        } catch (err) {
          console.error("Auto-approval failed:", err);
        }
      }

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

  // System status
  proposalScreener.get("/status", async (c) => {
    try {
      let trackingStats = null;
      try {
        const statsResponse = await fetch(
          `${process.env.API_URL}/api/proposals/stats` ||
            "http://localhost:3000/api/proposals/stats"
        );
        if (statsResponse.ok) {
          trackingStats = (await statsResponse.json()).stats;
        }
      } catch {
        // Ignore tracking stats errors
      }

      return c.json({
        autonomousMode: screener.autonomousMode,
        configured: !!(
          screener.votingContractId &&
          (screener.customContractId || screener.agentAccountId)
        ),
        agentAccount: screener.agentAccountId,
        customContract: screener.customContractId,
        mode: screener.customContractId ? "custom_contract" : "tee_fallback",
        totalScreened: screener.getScreeningHistory().length,
        tracking: trackingStats,
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
  proposalScreener.get("/results", (c) => {
    const results = screener.getScreeningHistory();
    return c.json({
      results: results.map((r) => ({
        proposalId: r.proposalId,
        approved: r.approved,
        reasons: r.reasons,
        executed: !!r.executionResult,
        timestamp: r.timestamp,
      })),
    });
  });

  // Agent information
  proposalScreener.get("/agent-info", async (c) => {
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

  // Debug endpoint for Anthropic API
  proposalScreener.get("/api/debug/anthropic", async (c) => {
    console.log("🧪 DEBUG: Anthropic test endpoint called");

    const debugInfo: {
      timestamp: string;
      environment: {
        anthropicKeyExists: boolean;
        anthropicKeyLength: number;
        anthropicKeyPreview: string;
        agentAccountId: string;
        votingContractId: string;
        allAnthropicKeys: string[];
        allAgentKeys: string[];
        allNearKeys: string[];
      };
      apiTest: any;
      error: string | null;
    } = {
      timestamp: new Date().toISOString(),
      environment: {
        anthropicKeyExists: !!process.env.ANTHROPIC_API_KEY,
        anthropicKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
        anthropicKeyPreview: process.env.ANTHROPIC_API_KEY
          ? process.env.ANTHROPIC_API_KEY.substring(0, 12) + "..."
          : "MISSING",
        agentAccountId: process.env.AGENT_ACCOUNT_ID || "MISSING",
        votingContractId: process.env.VOTING_CONTRACT_ID || "MISSING",
        allAnthropicKeys: Object.keys(process.env).filter((key) =>
          key.toLowerCase().includes("anthropic")
        ),
        allAgentKeys: Object.keys(process.env).filter((key) =>
          key.toLowerCase().includes("agent")
        ),
        allNearKeys: Object.keys(process.env).filter((key) =>
          key.toLowerCase().includes("near")
        ),
      },
      apiTest: null,
      error: null,
    };

    // If API key exists, test it
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        console.log("🧪 DEBUG: Testing Anthropic API call...");

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 10,
            messages: [
              {
                role: "user",
                content: 'Say "test successful"',
              },
            ],
          }),
        });

        console.log(
          "🧪 DEBUG: Anthropic API response status:",
          response.status
        );

        if (response.ok) {
          const data = await response.json();
          debugInfo.apiTest = {
            success: true,
            status: response.status,
            responsePreview: data.content?.[0]?.text || "No content",
            model: data.model,
            usage: data.usage,
          };
          console.log("🧪 DEBUG: API test successful");
        } else {
          const errorText = await response.text();
          debugInfo.apiTest = {
            success: false,
            status: response.status,
            statusText: response.statusText,
            error: errorText.substring(0, 200),
          };
          console.log("🧪 DEBUG: API test failed:", response.status);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("🧪 DEBUG: API test error:", errorMessage);
        debugInfo.error = `API test failed: ${errorMessage}`;
      }
    } else {
      debugInfo.error = "ANTHROPIC_API_KEY not found in environment variables";
      console.log("🧪 DEBUG: No API key found");
    }

    return c.json(debugInfo);
  });

  // Test contract connection
  proposalScreener.get("/test-connection", async (c) => {
    try {
      if (!screener.testContractConnection) {
        return c.json({
          success: false,
          error: "Contract testing not available",
        });
      }

      const isConnected = await screener.testContractConnection();

      return c.json({
        success: isConnected,
        message: isConnected ? "Connection successful" : "Connection failed",
        contractId: screener.customContractId,
        agentAccountId: screener.agentAccountId,
        mode: screener.customContractId ? "custom_contract" : "tee_fallback",
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

  // Test proposal approval
  proposalScreener.post("/test-approve", async (c) => {
    let proposalId = "13";

    try {
      const requestBody = await c.req.json().catch(() => ({}));
      proposalId = requestBody.proposalId || "13";

      if (!screener.autonomousMode) {
        return c.json({
          success: false,
          error: "Autonomous mode not enabled",
          config: {
            autonomousMode: screener.autonomousMode,
            agentAccountId: screener.agentAccountId,
            customContractId: screener.customContractId,
          },
        });
      }

      const result = await screener.approveProposal(proposalId);

      return c.json({
        success: true,
        proposalId,
        transactionHash: result.transactionHash,
        mode: screener.customContractId ? "custom_contract" : "tee",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          proposalId,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        500
      );
    }
  });

  // Debug configuration
  proposalScreener.get("/debug", async (c) => {
    const screenerConfig = {
      autonomousMode: screener.autonomousMode,
      agentAccountId: screener.agentAccountId,
      votingContractId: screener.votingContractId,
      customContractId: screener.customContractId,
      mode: screener.customContractId ? "custom_contract" : "tee_fallback",
    };

    return c.json({
      screenerConfig,
      isConfigured: !!(
        screener.votingContractId &&
        (screener.customContractId || screener.agentAccountId)
      ),
      timestamp: new Date().toISOString(),
    });
  });

  // Check agent balance
  proposalScreener.get("/balance", async (c) => {
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

  // Execute transaction (for external calls)
  proposalScreener.post("/execute-transaction", async (c) => {
    try {
      const { receiverId, actions } = await c.req.json();

      if (!receiverId || !actions) {
        return c.json({ error: "receiverId and actions required" }, 400);
      }

      const action = actions[0];
      const params = action.params;
      const depositValue = params.deposit || "1";

      const result = await agent("call", {
        contractId: receiverId,
        methodName: params.methodName,
        args: params.args,
        gas: params.gas,
        attachedDeposit: depositValue.toString(),
      });

      return c.json({
        success: true,
        result,
        transactionHash:
          result.transaction?.hash || result.hash || `call_${Date.now()}`,
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

  return proposalScreener;
}
