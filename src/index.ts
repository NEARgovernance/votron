import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import dotenv from "dotenv";
import WebSocket from "ws";
import {
  queuedAgent,
  queuedAgentAccountId,
  getQueueStatus,
} from "./agentQueue";

try {
  dotenv.config({ path: ".env.development.local" });
} catch (e) {
  console.log("No local env file found, using system environment");
}

console.log("🔍 Environment check:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("ANTHROPIC_API_KEY exists:", !!process.env.ANTHROPIC_API_KEY);
console.log("AGENT_ACCOUNT_ID:", process.env.AGENT_ACCOUNT_ID);

// Import services
import { ProposalScreener } from "./proposalScreener";
import createScreenerRoutes from "./routes/screener";
import createDebugRoutes from "./routes/debug";

import { agent, agentAccountId } from "@neardefi/shade-agent-js";

// Configuration
const VOTING_CONTRACT_ID =
  process.env.VOTING_CONTRACT_ID || "shade.ballotbox.testnet";
const NEAR_RPC_JSON =
  process.env.NEAR_RPC_JSON || "https://rpc.testnet.near.org";

// Initialize screener
const proposalScreener = new ProposalScreener({
  trustedProposers: [],
  blockedProposers: [],
  apiKey: process.env.ANTHROPIC_API_KEY,
  agentAccountId: process.env.AGENT_ACCOUNT_ID,
  votingContractId: process.env.VOTING_CONTRACT_ID,
});

// TESTING
const debugInfo = {
  lastWebSocketMessage: null as string | null,
  lastEventTime: null as string | null,
  wsMessageCount: 0,
};

// WebSocket monitoring
let eventClient: WebSocket | null = null;
let isConnecting = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Create Hono app
const app = new Hono();
app.use(cors());

// Health check
app.get("/", (c) => {
  const stats = proposalScreener.getScreeningStats();
  const execStats = proposalScreener.getExecutionStats();

  return c.json({
    message: "App is running",
    shadeAgent: "active",
    proposalScreener: "active",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    eventStream: eventClient ? "connected" : "disconnected",
    screener: {
      status: "active",
      totalScreened: stats.total,
      breakdown: stats.breakdown,
      lastScreened: stats.lastScreened,
    },
    execution: {
      totalExecutions: execStats.total,
      successful: execStats.successful,
      failed: execStats.failed,
    },
  });
});

app.get("/api/test", (c) => {
  console.log("🧪 Test API route hit!");
  return c.json({
    message: "API routing works!",
    timestamp: new Date().toISOString(),
    screenerTest: {
      hasScreener: !!proposalScreener,
      hasGetStats: typeof proposalScreener.getScreeningStats === "function",
      hasAgentAccount: !!proposalScreener.agentAccountId,
    },
  });
});
console.log("✅ Test route ready");

// Mount routes
app.route(
  "/api/screener",
  createScreenerRoutes(proposalScreener, {
    get eventClient() {
      return eventClient;
    },
    get isConnecting() {
      return isConnecting;
    },
    get reconnectAttempts() {
      return reconnectAttempts;
    },
    maxReconnectAttempts,
    VOTING_CONTRACT_ID,
  })
);

app.route(
  "/api/debug",
  createDebugRoutes(
    {
      eventClient,
      isConnecting,
      reconnectAttempts,
      maxReconnectAttempts,
      VOTING_CONTRACT_ID,
    },
    debugInfo
  )
);
app.route(
  "/debug",
  createDebugRoutes(
    {
      eventClient,
      isConnecting,
      reconnectAttempts,
      maxReconnectAttempts,
      VOTING_CONTRACT_ID,
    },
    debugInfo
  )
);
app.route("/api/agent", createShadeAgentApiRoutes());

// Agent status endpoint
app.get("/api/agent-status", async (c) => {
  try {
    let agentRegistered: boolean = false;
    let agentInfo: any = null;
    let contractBalance: any = null;
    let connectionError: string | null = null;

    console.log(`🔍 Starting agent status check with queue...`);

    let accountInfo: { accountId: string };
    let agentAccount: string;

    try {
      accountInfo = await queuedAgentAccountId();
      agentAccount = accountInfo.accountId;
      console.log(`✅ Got agent account: ${agentAccount}`);
    } catch (error: any) {
      console.warn("Could not get agent account:", error.message);
      connectionError = error.message;
      agentAccount = "unknown";
    }

    const agentContract: string =
      process.env.AGENT_ACCOUNT_ID || "ac-sandbox.votron.testnet";

    try {
      const agentCheckResult = await queuedAgent("view", {
        contractId: agentContract,
        methodName: "get_agent",
        args: { account_id: agentAccount },
      });

      // Check if the result contains an error
      if (agentCheckResult?.error) {
        agentRegistered = false;
        agentInfo = agentCheckResult;
        connectionError = agentCheckResult.error;
        console.warn("❌ Agent NOT registered:", agentCheckResult.error);
      } else {
        agentRegistered = true;
        agentInfo = agentCheckResult;
        console.log(`✅ Agent registration verified`);
      }
    } catch (error: any) {
      agentRegistered = false;
      agentInfo = { error: error.message };
      connectionError = error.message;
      console.warn("❌ Agent registration check failed:", error.message);
    }

    try {
      const balanceResult = await queuedAgent("view", {
        contractId: agentContract,
        methodName: "get_contract_balance",
        args: {},
      });
      contractBalance = balanceResult;
      console.log(`✅ Got contract balance`);
    } catch (error: any) {
      console.warn("Could not fetch balance:", error.message);
      connectionError = error.message;
    }

    const queueStatus = getQueueStatus();

    return c.json({
      agentContract: {
        contractId: agentContract,
        agentAccountId: agentAccount,
        agentRegistered,
        agentInfo,
        contractBalance,
        votingContract: VOTING_CONTRACT_ID,
        connectionError,
      },
      autoApproval: {
        enabled: agentRegistered,
        method: "agent_contract",
      },
      queueStatus,
    });
  } catch (error: any) {
    console.error("❌ Agent status check failed:", error);
    return c.json(
      {
        error: error.message,
        agentContract: {
          contractId: "ac-sandbox.votron.testnet",
          connectionError: error.message,
        },
      },
      200
    );
  }
});

app.get("/api/queue-status", (c) => {
  const status = getQueueStatus();
  return c.json({
    queue: status,
    timestamp: new Date().toISOString(),
    message: status.isProcessing
      ? "Queue is processing requests"
      : "Queue is idle",
  });
});

// Manual approval endpoint
app.post("/api/agent-approve", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { proposalId, force } = body;

    if (!proposalId) {
      return c.json({ error: "proposalId required" }, 400);
    }

    const screeningResult = proposalScreener.getScreeningResult(proposalId);
    if (!screeningResult) {
      return c.json({ error: "Proposal not found or not screened" }, 404);
    }

    if (proposalScreener.isProposalExecuted(proposalId)) {
      return c.json(
        {
          error: "Proposal already executed",
          executionResult: proposalScreener.getExecutionStatus(proposalId),
        },
        400
      );
    }

    if (!screeningResult.approved && !force) {
      return c.json(
        {
          error: "Proposal was rejected by AI. Use force=true to override.",
          screeningResult,
        },
        400
      );
    }

    const result = await proposalScreener.approveProposal(proposalId);

    return c.json({
      success: true,
      proposalId,
      forced: !!force,
      method: "agent_contract",
      result,
      message: `Proposal ${proposalId} approved via agent contract`,
    });
  } catch (error: any) {
    console.error("❌ Manual agent approval failed:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Shade Agent API routes (for library compatibility)
function createShadeAgentApiRoutes() {
  const agentApiRoutes = new Hono();

  agentApiRoutes.post("/getAccountId", async (c) => {
    try {
      const result = await agentAccountId();
      return c.json(result);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  agentApiRoutes.post("/getBalance", async (c) => {
    try {
      const result = await agent("getBalance");
      return c.json(result);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  agentApiRoutes.post("/call", async (c) => {
    try {
      const body = await c.req.json();
      const result = await agent("call", body);
      return c.json(result);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  agentApiRoutes.post("/view", async (c) => {
    try {
      const body = await c.req.json();
      const result = await agent("view", body);
      return c.json(result);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  agentApiRoutes.post("/:method", async (c) => {
    try {
      const method = c.req.param("method");
      const body = await c.req.json();
      const result = await agent(method, body);
      return c.json(result);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  return agentApiRoutes;
}

// WebSocket monitoring functions
interface ProposalData {
  title?: string;
  description?: string;
  link?: string;
  proposer_id?: string;
  deadline?: string;
  voting_end?: string;
  snapshot_block?: string;
  total_voting_power?: string;
}

async function fetchProposal(
  proposalId: string | number
): Promise<ProposalData> {
  const id = parseInt(proposalId.toString());
  console.log(`🔍 Fetching proposal ID: ${id}`);

  const payload = {
    jsonrpc: "2.0",
    id: "1",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "final",
      account_id: VOTING_CONTRACT_ID,
      method_name: "get_proposal",
      args_base64: Buffer.from(JSON.stringify({ proposal_id: id })).toString(
        "base64"
      ),
    },
  };

  const res = await fetch(NEAR_RPC_JSON, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`RPC request failed: ${res.status}`);
  }

  const json = await res.json();

  if (json.error) {
    throw new Error(`RPC error: ${json.error.message}`);
  }

  if (!json.result || !json.result.result || json.result.result.length === 0) {
    throw new Error(`Proposal ${proposalId} does not exist`);
  }

  const bytes = json.result.result;
  const raw = Buffer.from(bytes).toString("utf-8");
  return JSON.parse(raw);
}

async function handleNewProposal(proposalId: string, eventDetails: any) {
  try {
    console.log(`📝 Processing new proposal ${proposalId} with screener`);

    let proposal: ProposalData | null = null;
    let title = eventDetails.title || `Proposal #${proposalId}`;
    let description = eventDetails.description || "";
    let proposer_id = eventDetails.proposer_id;

    // Fetch full proposal details if needed
    if (!eventDetails.title || !eventDetails.description) {
      try {
        proposal = await fetchProposal(proposalId);
        title =
          eventDetails.title || proposal.title || `Proposal #${proposalId}`;
        description = eventDetails.description || proposal.description || "";
        proposer_id = eventDetails.proposer_id || proposal.proposer_id;
      } catch (error: any) {
        console.warn(
          `⚠️ Could not fetch full proposal details for ${proposalId}:`,
          error.message
        );
      }
    }

    // Screen the proposal
    const screeningResult = await proposalScreener.screenProposal(proposalId, {
      title,
      description,
      proposer_id,
      ...proposal,
    });

    console.log(`\n📋 NEW PROPOSAL DETECTED:`);
    console.log(`📝 Title: ${title}`);
    console.log(`👤 Proposer: ${proposer_id || "Unknown"}`);
    console.log(
      `📄 Description: ${description.substring(0, 150)}${
        description.length > 150 ? "..." : ""
      }`
    );
    console.log(
      `🤖 AI Decision: ${screeningResult.approved ? "APPROVED" : "REJECTED"}`
    );
    console.log(`📋 Reasons: ${screeningResult.reasons.join(" | ")}`);

    if (screeningResult.executionResult) {
      console.log(
        `🚀 Execution: ${screeningResult.executionResult.action.toUpperCase()}`
      );
      if (screeningResult.executionResult.transactionHash) {
        console.log(
          `🔗 Transaction: ${screeningResult.executionResult.transactionHash}`
        );
      }
    }
  } catch (error: any) {
    console.error(
      `❌ Failed to process new proposal ${proposalId}:`,
      error.message
    );
  }
}

async function handleProposalApproval(proposalId: string, eventDetails: any) {
  try {
    console.log(`✅ Processing approval for proposal ${proposalId}`);

    const existingResult = proposalScreener.getScreeningResult(proposalId);
    if (existingResult) {
      console.log(`\n🗳️ PROPOSAL ${proposalId} APPROVED FOR VOTING:`);
      console.log(
        `📋 Our screening: ${existingResult.approved ? "APPROVED" : "REJECTED"}`
      );
      console.log(`📋 Reasons: ${existingResult.reasons.join(" | ")}`);
    } else {
      console.log(
        `⚠️ Proposal ${proposalId} was approved but we haven't screened it`
      );
    }
  } catch (error: any) {
    console.error(
      `❌ Failed to process approval ${proposalId}:`,
      error.message
    );
  }
}

// Event processing helpers
function extractProposalId(event: any): string | null {
  const proposalId = event.event_data?.[0]?.proposal_id;
  return proposalId !== undefined ? proposalId.toString() : null;
}

function extractEventType(event: any): string | null {
  return event.event_event || null;
}

function extractAccountId(event: any): string | null {
  return event.account_id || null;
}

function extractProposalDetails(event: any) {
  const eventData = event.event_data?.[0] || {};
  return {
    proposalId: eventData.proposal_id,
    title: eventData.title,
    description: eventData.description,
    link: eventData.link,
    proposer_id: eventData.proposer_id,
    voting_options: eventData.voting_options,
  };
}

// WebSocket connection
async function startEventStream() {
  if (!VOTING_CONTRACT_ID) {
    console.log("⚠️ VOTING_CONTRACT_ID not set - skipping proposal monitoring");
    return;
  }

  if (isConnecting) {
    console.log("⏳ Event stream connection already in progress");
    return;
  }

  isConnecting = true;

  try {
    if (eventClient) {
      eventClient.close();
      eventClient = null;
    }

    console.log("🔗 Connecting to Intear WebSocket API...");
    eventClient = new WebSocket(
      "wss://ws-events-v3-testnet.intear.tech/events/log_nep297"
    );

    eventClient.on("open", () => {
      console.log("✅ WebSocket connected");

      const contractFilter = {
        And: [
          { path: "event_standard", operator: { Equals: "venear" } },
          { path: "account_id", operator: { Equals: VOTING_CONTRACT_ID } },
        ],
      };

      eventClient!.send(JSON.stringify(contractFilter));
      console.log("📤 Filter sent to WebSocket");

      reconnectAttempts = 0;
      isConnecting = false;
    });

    eventClient.on("message", async (data) => {
      try {
        const text = data.toString();

        // Store for debugging
        debugInfo.lastWebSocketMessage = text;
        debugInfo.lastEventTime = new Date().toISOString();
        debugInfo.wsMessageCount++;

        console.log("📨 Raw WebSocket message:", text);

        if (!text.startsWith("{") && !text.startsWith("[")) {
          console.log("📨 WebSocket message (non-JSON):", text);
          return;
        }

        const events = JSON.parse(text);
        console.log("📨 Parsed events:", JSON.stringify(events, null, 2));
        const eventArray = Array.isArray(events) ? events : [events];

        for (const event of eventArray) {
          const proposalId = extractProposalId(event);
          const eventType = extractEventType(event);
          const accountId = extractAccountId(event);

          if (accountId && accountId !== VOTING_CONTRACT_ID) {
            continue;
          }

          if (!proposalId || !eventType) {
            continue;
          }

          console.log(`🎯 PROCESSING ${eventType} for proposal ${proposalId}`);
          const eventDetails = extractProposalDetails(event);

          if (eventType === "create_proposal" || eventType.includes("create")) {
            await handleNewProposal(proposalId, eventDetails);
          } else if (
            eventType === "approve_proposal" ||
            eventType.includes("approve")
          ) {
            await handleProposalApproval(proposalId, eventDetails);
          } else {
            console.log(`⏩ Unhandled event type: ${eventType}`);
          }
        }
      } catch (err: any) {
        console.error("❌ Event processing error:", err);
      }
    });

    eventClient.on("close", () => {
      console.log("🔌 WebSocket closed");
      eventClient = null;
      isConnecting = false;

      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(
          `🔄 Retry attempt ${reconnectAttempts}/${maxReconnectAttempts}`
        );
        startEventStream();
      } else {
        console.error("❌ Max reconnection attempts reached");
      }
    });

    eventClient.on("error", (err) => {
      console.error("❌ WebSocket error:", err.message);
      if (eventClient) {
        eventClient.close();
        eventClient = null;
      }
      isConnecting = false;
    });
  } catch (err: any) {
    console.error("❌ Failed to create WebSocket:", err);
    isConnecting = false;
  }
}

// Start the server
const port = Number(process.env.PORT || "3000");

console.log(`🚀 Starting Proposal Reviewer Agent`);

// Start proposal monitoring
if (VOTING_CONTRACT_ID) {
  setTimeout(() => {
    console.log(
      `📋 Starting NEAR proposal monitoring for ${VOTING_CONTRACT_ID}...`
    );
    startEventStream();
  }, 2000);
}

serve({ fetch: app.fetch, port });
