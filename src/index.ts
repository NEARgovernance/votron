import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import dotenv from "dotenv";
import WebSocket from "ws";

try {
  dotenv.config({ path: ".env.development.local" });
} catch (e) {
  console.log("No local env file found, using system environment");
}

console.log("🔍 Environment check:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("ANTHROPIC_API_KEY exists:", !!process.env.ANTHROPIC_API_KEY);
console.log("AGENT_ACCOUNT_ID:", process.env.AGENT_ACCOUNT_ID);

// Import routes
import { ProposalScreener } from "./proposalScreener";
import createScreenerRoutes from "./routes/proposalScreener";

import { agent, agentAccountId } from "@neardefi/shade-agent-js";

// House of Stake config
const VOTING_CONTRACT_ID =
  process.env.VOTING_CONTRACT_ID || "shade.ballotbox.testnet";
const NEAR_RPC_JSON =
  process.env.NEAR_RPC_JSON || "https://rpc.testnet.near.org";

const proposalScreener = new ProposalScreener({
  trustedProposers: [],
  blockedProposers: [],
  apiKey: process.env.ANTHROPIC_API_KEY,
  agentAccountId: "ac-sandbox.votron.testnet",
  votingContractId: "shade.ballotbox.testnet",
});

// Event stream client for NEAR proposal monitoring
let eventClient: WebSocket | null = null;
let isConnecting = false;
let reconnectAttempts = 0;
``;
const maxReconnectAttempts = 5;

const app = new Hono();

// Configure CORS to restrict access to the server
app.use(cors());

// Enhanced health check with screener status
app.get("/", (c) => {
  const stats = proposalScreener.getScreeningStats();

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
  });
});

// Shade Agent routes
app.route("/api/screener", createScreenerRoutes(proposalScreener));
app.route("/api/agent", createShadeAgentApiRoutes());

app.get("/api/debug/websocket-status", (c) => {
  return c.json({
    connected: !!eventClient,
    isConnecting: isConnecting,
    reconnectAttempts: reconnectAttempts,
    votingContract: VOTING_CONTRACT_ID,
    maxReconnectAttempts: maxReconnectAttempts,
  });
});

app.get("/debug/env", (c) => {
  return c.json({
    nodeEnv: process.env.NODE_ENV,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    anthropicKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
    agentAccountId: process.env.AGENT_ACCOUNT_ID,
    allAnthropicKeys: Object.keys(process.env).filter((k) =>
      k.toLowerCase().includes("anthropic")
    ),
    envKeysCount: Object.keys(process.env).length,
  });
});

function createShadeAgentApiRoutes() {
  const agentApiRoutes = new Hono();

  agentApiRoutes.post("/getAccountId", async (c) => {
    try {
      console.log("🔧 shade-agent-js requesting getAccountId");
      const result = await agentAccountId();
      return c.json(result);
    } catch (error: any) {
      console.error("❌ getAccountId failed:", error.message);
      return c.json({ error: error.message }, 500);
    }
  });

  agentApiRoutes.post("/getBalance", async (c) => {
    try {
      console.log("🔧 shade-agent-js requesting getBalance");
      const result = await agent("getBalance");
      return c.json(result);
    } catch (error: any) {
      console.error("❌ getBalance failed:", error.message);
      return c.json({ error: error.message }, 500);
    }
  });

  agentApiRoutes.post("/call", async (c) => {
    try {
      console.log("🔧 shade-agent-js requesting call");
      const body = await c.req.json();
      console.log("📋 Call params:", body);

      const result = await agent("call", body);
      console.log("✅ Call result:", result);
      return c.json(result);
    } catch (error: any) {
      console.error("❌ Call failed:", error.message);
      return c.json({ error: error.message }, 500);
    }
  });

  agentApiRoutes.post("/functionCall", async (c) => {
    try {
      console.log("🔧 shade-agent-js requesting functionCall");
      const body = await c.req.json();
      const result = await agent("functionCall", body);
      return c.json(result);
    } catch (error: any) {
      console.error("❌ functionCall failed:", error.message);
      return c.json({ error: error.message }, 500);
    }
  });

  agentApiRoutes.post("/view", async (c) => {
    try {
      console.log("🔧 shade-agent-js requesting view");
      const body = await c.req.json();
      const result = await agent("view", body);
      return c.json(result);
    } catch (error: any) {
      console.error("❌ view failed:", error.message);
      return c.json({ error: error.message }, 500);
    }
  });

  // Generic handler for any other agent methods
  agentApiRoutes.post("/:method", async (c) => {
    try {
      const method = c.req.param("method");
      console.log(`🔧 shade-agent-js requesting ${method}`);
      const body = await c.req.json();
      const result = await agent(method, body);
      return c.json(result);
    } catch (error: any) {
      console.error(`❌ ${c.req.param("method")} failed:`, error.message);
      return c.json({ error: error.message }, 500);
    }
  });

  return agentApiRoutes;
}

// NEAR proposal monitoring functions
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

async function fetchWithTimeout(
  url: string,
  opts: any = {},
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
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

  const res = await fetchWithTimeout(
    NEAR_RPC_JSON,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    10000
  );

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
  const proposal = JSON.parse(raw);

  return proposal;
}

async function handleNewProposal(proposalId: string, eventDetails: any) {
  try {
    console.log(`📝 Processing new proposal ${proposalId} with screener`);

    let proposal: ProposalData | null = null;
    let title = eventDetails.title || `Proposal #${proposalId}`;
    let description = eventDetails.description || "";
    let proposer_id = eventDetails.proposer_id;

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

    // 🛡️ SCREEN THE PROPOSAL
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
    console.log(`📋 Reasons: ${screeningResult.reasons.join(" | ")}`);
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

    // Check if we already have a screening result
    const existingResult = proposalScreener.getScreeningResult(proposalId);

    if (existingResult) {
      console.log(`\n🗳️ PROPOSAL ${proposalId} APPROVED FOR VOTING:`);
      console.log(`📋 Reasons: ${existingResult.reasons.join(" | ")}`);
    } else {
      // Screen it now if we haven't seen it before
      let proposal: ProposalData | null = null;
      try {
        proposal = await fetchProposal(proposalId);
        await handleNewProposal(proposalId, proposal);
      } catch (error: any) {
        console.warn(
          `⚠️ Could not screen approved proposal ${proposalId}:`,
          error.message
        );
      }
    }
  } catch (error: any) {
    console.error(
      `❌ Failed to process approval ${proposalId}:`,
      error.message
    );
  }
}

// Helper functions to extract data from events
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

// Start blockchain event monitoring
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

        // Log ALL incoming messages for debugging
        console.log("🔥 RAW WebSocket message received:", text);

        if (!text.startsWith("{") && !text.startsWith("[")) {
          console.log("📨 WebSocket message (non-JSON):", text);
          return;
        }

        const events = JSON.parse(text);
        console.log("📥 Parsed events:", JSON.stringify(events, null, 2));

        const eventArray = Array.isArray(events) ? events : [events];

        for (const event of eventArray) {
          console.log("🔍 Processing event:", JSON.stringify(event, null, 2));

          const proposalId = extractProposalId(event);
          const eventType = extractEventType(event);
          const accountId = extractAccountId(event);

          console.log(
            `📋 Event details: type=${eventType}, proposalId=${proposalId}, account=${accountId}`
          );

          if (accountId && accountId !== VOTING_CONTRACT_ID) {
            console.log(
              `⏩ Skipping event from different contract: ${accountId}`
            );
            continue;
          }

          if (!proposalId || !eventType) {
            console.log(`⏩ Skipping event - missing proposalId or eventType`);
            continue;
          }

          console.log(`🎯 PROCESSING ${eventType} for proposal ${proposalId}`);
          const eventDetails = extractProposalDetails(event);

          if (
            eventType === "approve_proposal" ||
            eventType.includes("approve")
          ) {
            await handleProposalApproval(proposalId, eventDetails);
          } else if (
            eventType === "create_proposal" ||
            eventType.includes("create")
          ) {
            await handleNewProposal(proposalId, eventDetails);
          } else {
            console.log(`⏩ Unhandled event type: ${eventType}`);
          }
        }
      } catch (err: any) {
        console.error("❌ Event processing error:", err);
      }
    });

    eventClient.on("close", () => {
      console.log("🔌 WebSocket closed. Reconnecting...");
      eventClient = null;

      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectAttempts++;

        setTimeout(() => {
          console.log(
            `🔄 Retry attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`
          );
          isConnecting = false;
          startEventStream();
        }, delay);
      } else {
        console.error("❌ Max reconnection attempts reached");
        console.log("⚠️ Event stream disabled");
        isConnecting = false;
      }
    });

    eventClient.on("error", (err) => {
      console.error("❌ WebSocket error:", err.message);
      if (eventClient) {
        eventClient.close();
        eventClient = null;
      }
    });
  } catch (err: any) {
    console.error("❌ Failed to create WebSocket:", err);
    isConnecting = false;
  }
}

// Start the server
const port = Number(process.env.PORT || "3000");

console.log(`🚀 Starting Proposal Reviewer Agent`);

// Start proposal monitoring after a short delay to ensure server is ready
if (VOTING_CONTRACT_ID) {
  setTimeout(() => {
    console.log(
      `📋 Starting NEAR proposal monitoring for ${VOTING_CONTRACT_ID}...`
    );
    startEventStream();
  }, 2000);
}

serve({ fetch: app.fetch, port });
