import { Hono } from "hono";

const app = new Hono();

// Helper function to call TEE API directly
async function callTeeApi(
  endpoint: string,
  method: string = "GET",
  body?: any
) {
  const teeUrl =
    process.env.TEE_AGENT_URL ||
    "https://c4d25ca42346b738b6bdd5267cc78d3ebebb8164-3000.dstack-prod8.phala.network";

  const url = `${teeUrl}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `TEE API call failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return await response.json();
}

app.get("/", async (c) => {
  try {
    // Use TEE API to get agent info instead of shade-agent-js
    const agentInfo = await callTeeApi("/api/screener/agent-info");

    return c.json({
      accountId: agentInfo.agentAccountId || agentInfo.configuredAccountId,
      agentInfo: agentInfo,
      source: "tee-api-direct",
    });
  } catch (error: any) {
    console.log("Error getting agent account via TEE:", error);
    return c.json(
      { error: "Failed to get agent account: " + error.message },
      500
    );
  }
});

app.get("/debug-balance", async (c) => {
  try {
    // Try to get agent info via TEE API
    const agentInfo = await callTeeApi("/api/screener/agent-info");

    console.log("🔍 Agent Info from TEE:", agentInfo);

    return c.json({
      accountId: agentInfo.agentAccountId || agentInfo.configuredAccountId,
      agentInfo: agentInfo,
      votingContract: agentInfo.votingContract,
      source: "tee-api-direct",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.log("Error in debug-balance via TEE:", error);
    return c.json(
      { error: "Failed to get debug balance: " + error.message },
      500
    );
  }
});

app.post("/test-deposit-call", async (c) => {
  try {
    const { proposalId = "13" } = await c.req.json();

    console.log(`🧪 Testing TEE contract call for proposal ${proposalId}`);

    // Test direct TEE execution
    const result = await callTeeApi(
      "/api/screener/execute-transaction",
      "POST",
      {
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
              deposit: "1", // Use string format
            },
          },
        ],
      }
    );

    console.log(`✅ TEE call result:`, result);

    return c.json({
      success: result.success,
      result: result,
      transactionHash: result.transactionHash,
      method: "direct-tee-api",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.log("Error in test-deposit-call via TEE:", error);
    return c.json({ error: "TEE test failed: " + error.message }, 500);
  }
});

// Test TEE API connectivity
app.get("/test-tee-connection", async (c) => {
  try {
    const statusResult = await callTeeApi("/api/screener/status");

    return c.json({
      teeApiWorking: true,
      status: statusResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json(
      {
        teeApiWorking: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

export default app;
