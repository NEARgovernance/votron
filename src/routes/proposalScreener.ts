import { Hono } from "hono";
import { agent, agentAccountId, agentInfo } from "@neardefi/shade-agent-js";

const proposalScreener = new Hono();

interface Screener {
  screenProposal: (
    proposalId: string,
    proposal: any
  ) => Promise<{
    decision: string;
    reasons: string[];
    executionResult?: { transactionHash?: string };
    timestamp: string | number;
  }>;
  approveProposal: (
    proposalId: string
  ) => Promise<{ transactionHash?: string }>;
  getScreeningHistory: () => Array<{
    proposalId: string;
    decision: string;
    reasons: string[];
    executionResult?: { transactionHash?: string };
    timestamp: string | number;
  }>;
  autonomousMode: boolean;
  agentAccountId?: string;
  votingContractId?: string;
}

export default function createScreenerRoutes(screener: Screener) {
  // Screen a proposal and auto-approve/reject
  proposalScreener.post("/screen", async (c) => {
    try {
      const { proposalId, proposal } = await c.req.json();

      if (!proposalId || !proposal) {
        return c.json({ error: "proposalId and proposal required" }, 400);
      }

      // Screen the proposal with AI
      const result = await screener.screenProposal(proposalId, proposal);

      // Auto-execute if configured
      if (screener.autonomousMode && result.decision === "approve") {
        try {
          const execution = await screener.approveProposal(proposalId);
          // Note: execution result is already set by the screener
        } catch (err) {
          console.error("Auto-approval failed:", err);
        }
      }

      return c.json({
        proposalId: proposalId,
        decision: result.decision,
        reasons: result.reasons,
        executed: !!result.executionResult,
        transactionHash: result.executionResult?.transactionHash,
        timestamp: result.timestamp,
      });
    } catch (error) {
      const errorMessage =
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message?: string }).message || String(error)
          : String(error);
      return c.json({ error: errorMessage }, 500);
    }
  });

  proposalScreener.get("/debug-connection", async (c) => {
    const tests = [];

    // Test environment
    tests.push({
      test: "environment",
      API_PORT: process.env.API_PORT || "3140",
      NEXT_PUBLIC_contractId: process.env.NEXT_PUBLIC_contractId || "undefined",
    });

    // Test basic agent functions
    try {
      const accountInfo = await agentAccountId();
      tests.push({
        test: "agentAccountId",
        success: true,
        result: accountInfo,
      });
    } catch (err: any) {
      tests.push({
        test: "agentAccountId",
        success: false,
        error: err.message,
      });
    }

    return c.json({
      timestamp: new Date().toISOString(),
      tests: tests,
    });
  });

  proposalScreener.get("/check-balance", async (c) => {
    try {
      const balance = await agent("getBalance");
      const accountId = await agentAccountId();

      console.log(`💰 Agent balance check:`, balance);

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

  proposalScreener.get("/debug-agent-registration", async (c) => {
    try {
      console.log("🔍 Debugging agent registration...");

      // Check environment variables
      const envCheck = {
        AGENT_ACCOUNT_ID: process.env.AGENT_ACCOUNT_ID,
        VOTING_CONTRACT: process.env.VOTING_CONTRACT,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
          ? "✅ Set"
          : "❌ Missing",
        NODE_ENV: process.env.NODE_ENV,
        API_PORT: process.env.API_PORT,
        NEXT_PUBLIC_contractId: process.env.NEXT_PUBLIC_contractId,
      };

      console.log("📋 Environment variables:", envCheck);

      // Try to get agent account ID
      let agentId = null;
      try {
        const result = await agentAccountId();
        agentId = result.accountId;
        console.log("✅ Agent account ID retrieved:", agentId);
      } catch (error: any) {
        console.log("❌ Failed to get agent account ID:", error.message);
      }

      // Try to get agent info
      let agentInfoResult = null;
      try {
        agentInfoResult = await agentInfo();
        console.log("✅ Agent info retrieved:", agentInfoResult);
      } catch (error: any) {
        console.log("❌ Failed to get agent info:", error.message);
      }

      // Check screener configuration
      const screenerStatus = {
        autonomousMode: screener.autonomousMode,
        agentAccountId: screener.agentAccountId,
        votingContractId: screener.votingContractId,
        configured: !!(screener.agentAccountId && screener.votingContractId),
      };

      return c.json({
        environment: envCheck,
        agentAccountId: agentId,
        agentInfo: agentInfoResult,
        screenerStatus: screenerStatus,
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

  proposalScreener.post("/debug-contract-call", async (c) => {
    try {
      const { proposalId = "13" } = await c.req.json();

      console.log(`🧪 Testing contract call for proposal ${proposalId}`);

      // Test 1: View call (should work, no deposit needed)
      console.log("🔍 Step 1: Testing view call...");
      try {
        const viewResult = await agent("view", {
          contractId: "shade.ballotbox.testnet",
          methodName: "get_proposal",
          args: { proposal_id: parseInt(proposalId) },
        });
        console.log("✅ View call successful:", viewResult?.id);
      } catch (viewError: any) {
        console.log("❌ View call failed:", viewError.message);
        return c.json(
          {
            step: "view_call",
            success: false,
            error: viewError.message,
          },
          500
        );
      }

      // Test 2: Contract call with different deposit values
      const depositTests = ["0", "1", 1];

      for (const deposit of depositTests) {
        try {
          console.log(
            `🔄 Step 2: Testing approve_proposal with deposit=${deposit} (${typeof deposit})`
          );

          const result = await agent("call", {
            contractId: "shade.ballotbox.testnet",
            methodName: "approve_proposal",
            args: {
              proposal_id: parseInt(proposalId),
              voting_start_time_sec: null,
            },
            gas: "50000000000000",
            attachedDeposit: deposit,
          });

          console.log(`✅ SUCCESS with deposit=${deposit}:`, result);

          return c.json({
            success: true,
            workingDeposit: deposit,
            depositType: typeof deposit,
            result: result,
            transactionHash: result.transaction?.hash || result.hash,
            timestamp: new Date().toISOString(),
          });
        } catch (error: any) {
          console.log(`❌ deposit=${deposit} failed:`, error.message);

          // Continue to next test unless it's a non-deposit error
          if (
            !error.message.includes("deposit") &&
            !error.message.includes("yoctoNEAR")
          ) {
            return c.json(
              {
                success: false,
                deposit: deposit,
                error: error.message,
                note: "Non-deposit error - stopping tests",
                timestamp: new Date().toISOString(),
              },
              500
            );
          }
        }
      }

      return c.json({
        success: false,
        message: "All deposit values failed",
        testedDeposits: depositTests,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("❌ Debug test failed:", error);
      return c.json({ error: error.message }, 500);
    }
  });
  // Add this debug route to your proposalScreener routes

  proposalScreener.get("/debug-environment", async (c) => {
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_contractId: process.env.NEXT_PUBLIC_contractId,
      API_PORT: process.env.API_PORT,
      AGENT_ACCOUNT_ID: process.env.AGENT_ACCOUNT_ID,
      VOTING_CONTRACT: process.env.VOTING_CONTRACT,
      PORT: process.env.PORT,
    };

    // Test the shade-agent-js logic
    const contractId = process.env.NEXT_PUBLIC_contractId || "";
    const useShadeAgentApi = /sandbox/gim.test(contractId);
    const expectedApiPath = useShadeAgentApi ? "shade-agent-api" : "localhost";
    const apiPort = process.env.API_PORT || 3140;

    return c.json({
      environmentVariables: envVars,
      shadeAgentJsLogic: {
        contractId: contractId,
        regexTest: useShadeAgentApi,
        expectedHost: expectedApiPath,
        expectedPort: apiPort,
        expectedUrl: `http://${expectedApiPath}:${apiPort}`,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Add this to your proposalScreener routes for TEE testing

  proposalScreener.post("/test-tee-direct", async (c) => {
    try {
      const { proposalId = "13" } = await c.req.json();

      console.log(
        `🧪 Testing TEE direct contract call for proposal ${proposalId}`
      );

      // Test the exact same call your ProposalScreener is making
      const response = await fetch(
        `${
          process.env.TEE_AGENT_URL ||
          "https://c4d25ca42346b738b6bdd5267cc78d3ebebb8164-3000.dstack-prod8.phala.network"
        }/api/screener/execute-transaction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiverId: "shade.ballotbox.testnet",
            actions: [
              {
                type: "FunctionCall",
                params: {
                  methodName: "approve_proposal",
                  args: {
                    proposal_id: parseInt(proposalId),
                    voting_start_time_sec: null,
                  },
                  gas: "50000000000000",
                  deposit: "1", // String format
                },
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `TEE request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();

      console.log(`🎯 TEE response:`, result);

      // Check if it's the deposit error we've been seeing
      const hasDepositError = result.result?.error?.includes("yoctoNEAR");

      return c.json({
        success: true,
        teeResponse: result,
        hasDepositError: hasDepositError,
        analysis: hasDepositError
          ? "TEE is working but deposit parameter needs fixing in execute-transaction route"
          : "TEE call successful!",
        nextStep: hasDepositError
          ? "Fix the attachedDeposit parameter in /execute-transaction route"
          : "System is working correctly",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("❌ TEE test failed:", error);
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

  proposalScreener.get("/debug-phala-networking", async (c) => {
    try {
      const debug = {
        environment: process.env.NODE_ENV,
        contractId: process.env.NEXT_PUBLIC_contractId,
        expectedApiPath: /sandbox/gim.test(
          process.env.NEXT_PUBLIC_contractId || ""
        )
          ? "shade-agent-api"
          : "localhost",
        apiPort: process.env.API_PORT || 3140,
      };

      // Test different hostname resolutions
      const hostnameTests = [];

      // Test 1: Try to connect to shade-agent-api directly
      try {
        const response = await fetch(
          `http://shade-agent-api:${debug.apiPort}/api/agent/getAccountId`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );
        hostnameTests.push({
          hostname: "shade-agent-api",
          success: true,
          status: response.status,
        });
      } catch (error: any) {
        hostnameTests.push({
          hostname: "shade-agent-api",
          success: false,
          error: error.message,
        });
      }

      // Test 2: Try localhost
      try {
        const response = await fetch(
          `http://localhost:${debug.apiPort}/api/agent/getAccountId`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );
        hostnameTests.push({
          hostname: "localhost",
          success: true,
          status: response.status,
        });
      } catch (error: any) {
        hostnameTests.push({
          hostname: "localhost",
          success: false,
          error: error.message,
        });
      }

      // Test 3: Try the external Phala URL (should fail from inside)
      try {
        const response = await fetch(
          `https://c4d25ca42346b738b6bdd5267cc78d3ebebb8164-3000.dstack-prod8.phala.network/api/agent-account`,
          {
            method: "GET",
          }
        );
        hostnameTests.push({
          hostname: "external-phala-url",
          success: true,
          status: response.status,
        });
      } catch (error: any) {
        hostnameTests.push({
          hostname: "external-phala-url",
          success: false,
          error: error.message,
        });
      }

      return c.json({
        debug,
        hostnameTests,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // Add this test route to your proposalScreener routes (don't replace existing route)

  proposalScreener.post("/test-deposit-formats", async (c) => {
    try {
      const { proposalId = "13" } = await c.req.json();

      console.log(
        `🧪 Testing different deposit parameter formats for proposal ${proposalId}`
      );

      const depositTests = [
        { name: "attachedDeposit: '1'", params: { attachedDeposit: "1" } },
        { name: "attachedDeposit: 1", params: { attachedDeposit: 1 } },
        { name: "deposit: '1'", params: { deposit: "1" } },
        { name: "deposit: 1", params: { deposit: 1 } },
        { name: "amount: '1'", params: { amount: "1" } },
        { name: "yoctoNEAR: '1'", params: { yoctoNEAR: "1" } },
      ];

      const results = [];

      for (const test of depositTests) {
        try {
          console.log(`🔄 Testing: ${test.name}`);

          const callParams = {
            contractId: "shade.ballotbox.testnet",
            methodName: "approve_proposal",
            args: {
              proposal_id: parseInt(proposalId),
              voting_start_time_sec: null,
            },
            gas: "50000000000000",
            ...test.params,
          };

          const result = await agent("call", callParams);

          console.log(`✅ SUCCESS with ${test.name}`);

          results.push({
            format: test.name,
            success: true,
            transactionHash: result.transaction?.hash || result.hash,
          });

          // Stop on first success for now
          break;
        } catch (error: any) {
          console.log(`❌ ${test.name} failed:`, error.message);

          results.push({
            format: test.name,
            success: false,
            error: error.message,
            isDepositError: error.message.includes("yoctoNEAR"),
          });
        }
      }

      return c.json({
        message: "Deposit format testing completed",
        results: results,
        successfulFormat: results.find((r) => r.success)?.format || "none",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  proposalScreener.post("/execute-transaction", async (c) => {
    try {
      const { receiverId, actions } = await c.req.json();

      if (!receiverId || !actions) {
        return c.json({ error: "receiverId and actions required" }, 400);
      }

      const action = actions[0];
      const params = action.params;

      console.log(`🚀 Executing transaction to ${receiverId}`);
      console.log(`📋 Method: ${params.methodName}`);
      console.log(`📋 Args:`, JSON.stringify(params.args, null, 2));
      console.log(`📋 Gas:`, params.gas);
      console.log(
        `📋 Deposit from request:`,
        params.deposit,
        typeof params.deposit
      );

      // Use the exact deposit value from the request
      const depositValue = params.deposit || "1";
      console.log(`💰 Using deposit:`, depositValue, typeof depositValue);

      const result = await agent("call", {
        contractId: receiverId,
        methodName: params.methodName,
        args: params.args,
        gas: params.gas,
        attachedDeposit: depositValue.toString(), // Ensure it's a string
      });

      console.log(`✅ Transaction successful:`, result);

      return c.json({
        success: true,
        result: result,
        depositUsed: depositValue,
        transactionHash:
          result.transaction?.hash || result.hash || `call_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error(`❌ Transaction failed:`, error);

      // Include more debug info in the error response
      let action;
      try {
        const { actions } = await c.req.json();
        action = actions?.[0];
      } catch {
        action = undefined;
      }
      return c.json(
        {
          success: false,
          error: error.message,
          debugInfo: {
            receiverId: action?.params?.receiverId ?? "unknown",
            methodName: action?.params?.methodName,
            depositAttempted: action?.params?.deposit,
          },
          timestamp: new Date().toISOString(),
        },
        500
      );
    }
  });

  // Get all screening results
  proposalScreener.get("/results", (c) => {
    const results = screener.getScreeningHistory();
    return c.json({
      results: results.map((r) => ({
        proposalId: r.proposalId,
        decision: r.decision,
        reasons: r.reasons,
        executed: !!r.executionResult,
        timestamp: r.timestamp,
      })),
    });
  });

  // Get simple status
  proposalScreener.get("/status", (c) => {
    return c.json({
      autonomousMode: screener.autonomousMode,
      configured: !!(screener.agentAccountId && screener.votingContractId),
      agentAccount: screener.agentAccountId,
      totalScreened: screener.getScreeningHistory().length,
    });
  });

  proposalScreener.get("/agent-info", async (c) => {
    try {
      const accountInfo = await agentAccountId();
      const agentDetails = await agentInfo();

      return c.json({
        agentAccountId: accountInfo.accountId,
        agentInfo: agentDetails,
        configuredAccountId: screener.agentAccountId,
        votingContract: screener.votingContractId,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return c.json({ error: errorMessage }, 500);
    }
  });
  proposalScreener.get("/test-api", async (c) => {
    try {
      // Check if Anthropic API key exists
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        return c.json({
          success: false,
          error: "ANTHROPIC_API_KEY not found in environment variables",
        });
      }

      const maskedKey =
        apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4);
      console.log(`🔑 Testing Anthropic API key: ${maskedKey}`);

      // Test Anthropic API
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 50,
          messages: [
            {
              role: "user",
              content: "Say 'API test successful' if you can read this.",
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return c.json({
          success: false,
          error: `Anthropic API error: ${response.status} ${response.statusText}`,
          details: data,
          apiKey: maskedKey,
        });
      }

      return c.json({
        success: true,
        provider: "anthropic",
        response: data.content[0].text,
        apiKey: maskedKey,
        model: "claude-3-5-sonnet-20241022",
      });
    } catch (error) {
      return c.json({
        success: false,
        error:
          typeof error === "object" && error !== null && "message" in error
            ? (error as { message?: string }).message || String(error)
            : String(error),
      });
    }
  });

  return proposalScreener;
}
