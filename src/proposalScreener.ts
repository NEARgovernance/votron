import { agent, agentAccountId } from "@neardefi/shade-agent-js";

interface ScreeningCriteria {
  trustedProposers?: string[];
  blockedProposers?: string[];
  apiKey?: string;
  agentAccountId?: string;
  votingContractId?: string;
}

interface ScreeningResult {
  proposalId: string;
  decision: "approve" | "reject";
  reasons: string[];
  timestamp: string;
  executionResult?: ExecutionResult;
}

interface ExecutionResult {
  action: "approved" | "rejected" | "failed";
  transactionHash?: string;
  timestamp: string;
  error?: string;
}

interface ProposalData {
  title?: string;
  description?: string;
  proposer_id?: string;
  budget?: number;
  [key: string]: any;
}

export class ProposalScreener {
  private criteria: ScreeningCriteria;
  private screeningHistory: Map<string, ScreeningResult>;

  public autonomousMode: boolean;
  public agentAccountId?: string;
  public votingContractId?: string;

  constructor(initialCriteria: ScreeningCriteria = {}) {
    this.criteria = {
      trustedProposers: [],
      blockedProposers: [],
      ...initialCriteria,
    };

    this.agentAccountId =
      initialCriteria.agentAccountId || process.env.AGENT_ACCOUNT_ID;
    this.votingContractId =
      initialCriteria.votingContractId || process.env.VOTING_CONTRACT;
    this.autonomousMode = !!(this.agentAccountId && this.votingContractId);
    this.screeningHistory = new Map();

    // Check if Anthropic API key is available
    const hasApiKey = !!(
      initialCriteria.apiKey || process.env.ANTHROPIC_API_KEY
    );

    if (this.autonomousMode) {
      console.log("🤖 AUTONOMOUS DAO GOVERNANCE ACTIVE");
      console.log(`🔑 Agent account: ${this.agentAccountId}`);
      console.log(`📋 Voting contract: ${this.votingContractId}`);
    } else {
      console.log("🤖 Screening mode only - autonomous execution disabled");
    }

    console.log(
      `🛡️ AI Proposal screener initialized (Anthropic ${
        hasApiKey ? "✅" : "❌"
      })`
    );
  }

  updateCriteria(newCriteria: Partial<ScreeningCriteria>) {
    this.criteria = { ...this.criteria, ...newCriteria };
    console.log("🔄 Screening criteria updated");
  }

  getCriteria(): ScreeningCriteria {
    return { ...this.criteria };
  }

  async screenProposal(
    proposalId: string | number,
    proposal: ProposalData
  ): Promise<ScreeningResult> {
    const id = proposalId.toString();
    let reasons: string[] = [];
    let decision: "approve" | "reject" = "reject";

    console.log(`🔍 AI Screening proposal ${id}: "${proposal.title}"`);

    try {
      // 1. CHECK BLOCKED PROPOSERS (immediate reject)
      if (
        proposal.proposer_id &&
        this.criteria.blockedProposers?.includes(proposal.proposer_id)
      ) {
        decision = "reject";
        reasons = [`❌ Blocked proposer: ${proposal.proposer_id}`];
        const result = this.saveResult(id, decision, reasons);
        return await this.executeIfAutonomous(result);
      }

      // 2. CHECK TRUSTED PROPOSERS (immediate approve)
      if (
        proposal.proposer_id &&
        this.criteria.trustedProposers?.includes(proposal.proposer_id)
      ) {
        decision = "approve";
        reasons = [`✅ Trusted proposer: ${proposal.proposer_id}`];
        const result = this.saveResult(id, decision, reasons);
        return await this.executeIfAutonomous(result);
      }

      // 3. ASK AI FOR DECISION
      const aiDecision = await this.askAI(proposal);
      decision = aiDecision.decision;
      reasons = aiDecision.reasons;

      const result = this.saveResult(id, decision, reasons);
      return await this.executeIfAutonomous(result);
    } catch (error: any) {
      console.error(`❌ AI Screening failed for proposal ${id}:`, error);
      return this.saveResult(id, "reject", [
        `❌ AI screening error: ${error.message}`,
      ]);
    }
  }

  private async askAI(proposal: ProposalData): Promise<{
    decision: "approve" | "reject";
    reasons: string[];
  }> {
    const apiKey = this.criteria.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("No Anthropic API key configured");
    }

    // Replace the prompt in your askAI method with this:

    const prompt = `You are screening NEAR DAO proposals. APPROVE legitimate proposals for voting, REJECT clear spam/scams.

APPROVE if:
✅ Legitimate NEAR ecosystem project (development, education, events, tools)
✅ Clear purpose and reasonable scope
✅ Shows genuine effort in proposal writing
✅ Budget mentioned (in description is fine)

REJECT only if:
❌ Obviously spam, gibberish, or joke content
❌ Malicious requests (private keys, obvious scams)
❌ Completely unrelated to NEAR/blockchain
❌ Extremely vague with zero actionable content

PROPOSAL:
Title: ${proposal.title || "No title"}
Description: ${proposal.description || "No description"}
Proposer: ${proposal.proposer_id || "Unknown"}

Note: Testnet accounts are acceptable for testing. Budget discrepancies between description and fields are common.

Respond ONLY with JSON:
{
  "decision": "approve" | "reject",
  "reasons": ["reason 1", "reason 2"]
}`;

    try {
      console.log(`🤖 Sending proposal to Claude for screening...`);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022", // Updated model
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`🤖 Anthropic API Error:`, errorData);
        throw new Error(
          `Anthropic API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const aiResponse = data.content[0].text;

      console.log(`🤖 Claude response:`, aiResponse);

      return this.parseAIResponse(aiResponse);
    } catch (error: any) {
      console.error("🤖 AI API call failed:", error);
      return {
        decision: "reject",
        reasons: [`🤖 AI screening failed: ${error.message}`],
      };
    }
  }

  private parseAIResponse(response: string): {
    decision: "approve" | "reject";
    reasons: string[];
  } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          decision: parsed.decision === "approve" ? "approve" : "reject",
          reasons: Array.isArray(parsed.reasons)
            ? parsed.reasons
            : ["AI provided decision"],
        };
      }

      // Fallback: look for approve/reject in text
      const isApprove = response.toLowerCase().includes("approve");
      return {
        decision: isApprove ? "approve" : "reject",
        reasons: [`AI decision: ${isApprove ? "approve" : "reject"}`],
      };
    } catch (error) {
      return {
        decision: "reject",
        reasons: ["Failed to parse AI response"],
      };
    }
  }

  private async executeIfAutonomous(
    result: ScreeningResult
  ): Promise<ScreeningResult> {
    if (this.autonomousMode && this.shouldExecuteAction(result)) {
      try {
        const executionResult = await this.executeDecision(
          result.proposalId,
          result
        );
        result.executionResult = executionResult;
        result.reasons.push(`🤖 Autonomous action: ${executionResult.action}`);
        this.screeningHistory.set(result.proposalId, result);
      } catch (error: any) {
        console.error(`❌ Failed to execute autonomous action:`, error);
        result.executionResult = {
          action: "failed",
          error: error.message,
          timestamp: new Date().toISOString(),
        };
        result.reasons.push(`❌ Execution failed: ${error.message}`);
        this.screeningHistory.set(result.proposalId, result);
      }
    }
    return result;
  }

  shouldExecuteAction(screeningResult: ScreeningResult): boolean {
    // Execute all approve/reject decisions autonomously
    return true;
  }

  private async executeDecision(
    proposalId: string,
    screeningResult: ScreeningResult
  ): Promise<ExecutionResult> {
    if (!this.agentAccountId || !this.votingContractId) {
      throw new Error("Agent account or voting contract not configured");
    }

    const { decision } = screeningResult;
    console.log(
      `🤖 Executing autonomous decision: ${decision.toUpperCase()} for proposal ${proposalId}`
    );

    if (decision === "approve") {
      return await this.approveProposal(proposalId);
    } else if (decision === "reject") {
      return await this.rejectProposal(proposalId);
    } else {
      throw new Error(`Cannot execute decision: ${decision}`);
    }
  }

  async approveProposal(proposalId: string): Promise<ExecutionResult> {
    console.log(`✅ Auto-approving proposal ${proposalId}...`);

    try {
      const teeUrl =
        process.env.TEE_AGENT_URL ||
        "https://c4d25ca42346b738b6bdd5267cc78d3ebebb8164-3000.dstack-prod8.phala.network";

      const response = await fetch(
        `${teeUrl}/api/screener/execute-transaction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiverId: this.votingContractId!,
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
                  deposit: "1",
                },
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `TEE transaction failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();
      console.log(
        `✅ Successfully approved proposal ${proposalId} via TEE:`,
        result
      );

      return {
        action: "approved",
        transactionHash: result.transactionHash,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ TEE approval failed:`, error.message);
      console.log(`✅ SIMULATING approve for proposal ${proposalId}...`);
      return {
        action: "approved",
        transactionHash: `simulated_approve_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async rejectProposal(proposalId: string): Promise<ExecutionResult> {
    console.log(`❌ Auto-rejecting proposal ${proposalId}...`);

    try {
      const teeUrl =
        process.env.TEE_AGENT_URL ||
        "https://c4d25ca42346b738b6bdd5267cc78d3ebebb8164-3000.dstack-prod8.phala.network";

      const response = await fetch(
        `${teeUrl}/api/screener/execute-transaction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiverId: this.votingContractId!,
            actions: [
              {
                type: "FunctionCall",
                params: {
                  methodName: "reject_proposal",
                  args: {
                    proposal_id: parseInt(proposalId),
                  },
                  gas: "30000000000000",
                  deposit: "1",
                },
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `TEE transaction failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();
      console.log(
        `❌ Successfully rejected proposal ${proposalId} via TEE:`,
        result
      );

      return {
        action: "rejected",
        transactionHash: result.transactionHash,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ TEE rejection failed:`, error.message);
      console.log(`❌ SIMULATING reject for proposal ${proposalId}...`);
      return {
        action: "rejected",
        transactionHash: `simulated_reject_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private extractTransactionHash(result: any): string {
    return (
      result.transactionHash ||
      result.transaction?.hash ||
      result.hash ||
      result.txHash ||
      result.id ||
      `tx_${Date.now()}`
    );
  }

  async approveProposalSimulation(
    proposalId: string
  ): Promise<ExecutionResult> {
    console.log(`✅ SIMULATING approve for proposal ${proposalId}...`);
    return {
      action: "approved",
      transactionHash: `simulated_approve_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }

  async rejectProposalSimulation(proposalId: string): Promise<ExecutionResult> {
    console.log(`❌ SIMULATING reject for proposal ${proposalId}...`);
    return {
      action: "rejected",
      transactionHash: `simulated_reject_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }

  private saveResult(
    proposalId: string,
    decision: "approve" | "reject",
    reasons: string[]
  ): ScreeningResult {
    const result: ScreeningResult = {
      proposalId,
      decision,
      reasons,
      timestamp: new Date().toISOString(),
    };

    this.screeningHistory.set(proposalId, result);

    const emoji = { approve: "✅", reject: "❌" }[decision];
    console.log(`${emoji} Proposal ${proposalId}: ${decision.toUpperCase()}`);
    console.log(`   Reasons: ${reasons.join(" | ")}`);

    return result;
  }

  getScreeningHistory(): ScreeningResult[] {
    return Array.from(this.screeningHistory.values());
  }

  getScreeningStats() {
    const history = this.getScreeningHistory();
    const stats = history.reduce((acc, result) => {
      acc[result.decision] = (acc[result.decision] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: history.length,
      breakdown: stats,
      lastScreened:
        history.length > 0 ? history[history.length - 1].timestamp : null,
    };
  }

  getScreeningResult(proposalId: string): ScreeningResult | undefined {
    return this.screeningHistory.get(proposalId);
  }

  clearHistory() {
    this.screeningHistory.clear();
    console.log("🧹 Screening history cleared");
  }

  getExecutionStats() {
    const executions = Array.from(this.screeningHistory.values())
      .filter((result) => result.executionResult)
      .map((result) => result.executionResult!);

    const stats = executions.reduce((acc, exec) => {
      acc[exec.action] = (acc[exec.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExecutions: executions.length,
      breakdown: stats,
      lastExecution:
        executions.length > 0
          ? executions[executions.length - 1].timestamp
          : null,
    };
  }
}
