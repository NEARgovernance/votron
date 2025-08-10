import { agent, agentCall } from "@neardefi/shade-agent-js";

interface ScreeningCriteria {
  trustedProposers?: string[];
  blockedProposers?: string[];
  apiKey?: string;
  agentAccountId?: string;
  votingContractId?: string;
  customContractId?: string;
}

interface ScreeningResult {
  proposalId: string;
  approved: boolean;
  reasons: string[];
  timestamp: string;
  executionResult?: ExecutionResult;
}

interface ExecutionResult {
  action: "approved" | "failed";
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
  private executionResults: Map<string, any>;

  public autonomousMode: boolean;
  public agentAccountId?: string;
  public votingContractId?: string;
  public customContractId?: string;

  constructor(initialCriteria: ScreeningCriteria = {}) {
    this.criteria = {
      trustedProposers: [],
      blockedProposers: [],
      ...initialCriteria,
    };

    this.agentAccountId =
      initialCriteria.agentAccountId || process.env.AGENT_ACCOUNT_ID;
    this.votingContractId =
      initialCriteria.votingContractId ||
      process.env.VOTING_CONTRACT_ID ||
      "shade.ballotbox.testnet";
    this.customContractId =
      initialCriteria.customContractId || process.env.CUSTOM_CONTRACT_ID;
    this.autonomousMode = !!(this.agentAccountId && this.votingContractId);
    this.screeningHistory = new Map();
    this.executionResults = new Map();

    console.log(
      `🛡️ AI Proposal screener initialized (Anthropic ${
        this.criteria.apiKey ? "✅" : "❌"
      })`
    );
    if (this.autonomousMode) {
      console.log("🤖 AUTONOMOUS DAO GOVERNANCE ACTIVE");
      console.log(`🔑 Agent account: ${this.agentAccountId}`);
      console.log(`📋 Voting contract: ${this.votingContractId}`);
    }
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
    let approved: boolean = false;

    console.log(`🔍 AI Screening proposal ${id}: "${proposal.title}"`);

    try {
      // 1. CHECK BLOCKED PROPOSERS (immediate reject)
      if (
        proposal.proposer_id &&
        this.criteria.blockedProposers?.includes(proposal.proposer_id)
      ) {
        approved = false;
        reasons = [`❌ Blocked proposer: ${proposal.proposer_id}`];
        const result = this.saveResult(id, approved, reasons);
        return await this.executeIfAutonomous(result);
      }

      // 2. CHECK TRUSTED PROPOSERS (immediate approve)
      if (
        proposal.proposer_id &&
        this.criteria.trustedProposers?.includes(proposal.proposer_id)
      ) {
        approved = true;
        reasons = [`✅ Trusted proposer: ${proposal.proposer_id}`];
        const result = this.saveResult(id, approved, reasons);
        return await this.executeIfAutonomous(result);
      }

      // 3. ASK AI FOR DECISION
      const aiDecision = await this.askAI(proposal);
      approved = aiDecision.approved;
      reasons = aiDecision.reasons;

      const result = this.saveResult(id, approved, reasons);
      return await this.executeIfAutonomous(result);
    } catch (error: any) {
      console.error(`❌ AI Screening failed for proposal ${id}:`, error);
      return this.saveResult(id, false, [
        `❌ AI screening error: ${error.message}`,
      ]);
    }
  }

  private async askAI(
    proposal: ProposalData
  ): Promise<{ approved: boolean; reasons: string[] }> {
    const apiKey = this.criteria.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("No Anthropic API key configured");
    }

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
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Anthropic API error: ${response.status} - ${errorText.substring(
            0,
            200
          )}`
        );
      }

      const data = await response.json();
      const aiResponse = data.content[0].text;
      return this.parseAIResponse(aiResponse);
    } catch (error: any) {
      console.error("🤖 AI API call failed:", error);
      throw new Error(`AI screening failed: ${error.message}`);
    }
  }

  private parseAIResponse(response: string): {
    approved: boolean;
    reasons: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          approved: parsed.decision === "approve",
          reasons: Array.isArray(parsed.reasons)
            ? parsed.reasons
            : ["AI provided decision"],
        };
      }

      const isApprove = response.toLowerCase().includes("approve");
      return {
        approved: isApprove,
        reasons: [`AI decision: ${isApprove ? "approve" : "reject"}`],
      };
    } catch (error) {
      return {
        approved: false,
        reasons: ["Failed to parse AI response"],
      };
    }
  }

  private async executeIfAutonomous(
    result: ScreeningResult
  ): Promise<ScreeningResult> {
    if (this.autonomousMode && result.approved) {
      try {
        console.log(
          `🤖 Executing autonomous approval for proposal ${result.proposalId}`
        );
        const executionResult = await this.approveProposal(result.proposalId);
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

  async approveProposal(proposalId: string): Promise<ExecutionResult> {
    console.log(`✅ Auto-approving proposal ${proposalId}...`);

    if (this.isProposalExecuted(proposalId)) {
      throw new Error(`Proposal ${proposalId} already executed`);
    }

    try {
      const result = this.customContractId
        ? await this.executeViaAgentContract(proposalId)
        : await this.executeViaTEE(proposalId);

      // Store execution result
      this.executionResults.set(proposalId, {
        executed: true,
        executionTxHash: result.transactionHash,
        executedAt: new Date().toISOString(),
        executionMethod: this.customContractId ? "agent_contract" : "tee",
        success: true,
      });

      return result;
    } catch (error: any) {
      console.error(`❌ Approval failed:`, error.message);

      this.executionResults.set(proposalId, {
        executed: false,
        executionError: error.message,
        executionMethod: this.customContractId
          ? "agent_contract_failed"
          : "tee_failed",
        success: false,
        attemptedAt: new Date().toISOString(),
      });

      return {
        action: "failed",
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private async executeViaAgentContract(
    proposalId: string
  ): Promise<ExecutionResult> {
    console.log(
      `🤖 Executing via agent contract for proposal ${proposalId}...`
    );

    const result = await agentCall({
      methodName: "approve_proposal",
      args: {
        proposal_id: parseInt(proposalId),
        voting_start_time_sec: null,
      },
    });

    return {
      action: "approved",
      transactionHash:
        result.transaction?.hash || result.txHash || `agent_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }

  private async executeViaTEE(proposalId: string): Promise<ExecutionResult> {
    console.log(`🛡️ Executing via TEE for proposal ${proposalId}...`);

    const teeUrl =
      process.env.API_URL ||
      "https://e3303d7df5813ffb9c8a5a60abdedba3f304069a-3000.dstack-prod7.phala.network";

    const response = await fetch(`${teeUrl}/api/screener/execute-transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `TEE transaction failed: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();
    return {
      action: "approved",
      transactionHash: result.transactionHash || `tee_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }

  async testContractConnection(): Promise<boolean> {
    try {
      if (this.customContractId) {
        await agent("view", {
          contractId: this.agentAccountId!,
          methodName: "get_agent",
          args: { account_id: this.agentAccountId },
        });
        return true;
      } else {
        const teeUrl =
          process.env.API_URL ||
          "https://e3303d7df5813ffb9c8a5a60abdedba3f304069a-3000.dstack-prod7.phala.network";
        const response = await fetch(`${teeUrl}/`);
        return response.ok;
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }

  private saveResult(
    proposalId: string,
    approved: boolean,
    reasons: string[]
  ): ScreeningResult {
    const result: ScreeningResult = {
      proposalId,
      approved,
      reasons,
      timestamp: new Date().toISOString(),
    };

    this.screeningHistory.set(proposalId, result);

    const emoji = approved ? "✅" : "⏸️";
    const decisionText = approved ? "APPROVED" : "NOT APPROVED";
    console.log(`${emoji} Proposal ${proposalId}: ${decisionText}`);
    console.log(`   Reasons: ${reasons.join(" | ")}`);

    return result;
  }

  getScreeningHistory(): ScreeningResult[] {
    return Array.from(this.screeningHistory.values());
  }

  getScreeningResult(proposalId: string): ScreeningResult | undefined {
    return this.screeningHistory.get(proposalId);
  }

  getScreeningStats() {
    const history = this.getScreeningHistory();
    const approved = history.filter((r) => r.approved).length;
    const notApproved = history.length - approved;

    return {
      total: history.length,
      breakdown: { approved, notApproved },
      lastScreened:
        history.length > 0 ? history[history.length - 1].timestamp : null,
    };
  }

  // Execution tracking methods
  getExecutionStatus(proposalId: string) {
    return this.executionResults.get(proposalId) || null;
  }

  isProposalExecuted(proposalId: string): boolean {
    const result = this.executionResults.get(proposalId);
    return result?.executed === true;
  }

  getRecentExecutions(limit: number = 10) {
    return Array.from(this.executionResults.entries())
      .map(([proposalId, result]) => ({ proposalId, ...result }))
      .sort((a, b) => {
        const timeA = new Date(a.executedAt || a.attemptedAt || 0).getTime();
        const timeB = new Date(b.executedAt || b.attemptedAt || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, limit);
  }

  getExecutionStats() {
    const executions = Array.from(this.executionResults.values());
    const successful = executions.filter((e) => e.executed && e.success).length;
    const failed = executions.filter((e) => !e.success).length;

    return {
      total: executions.length,
      successful,
      failed,
      pending: executions.filter((e) => !e.executed).length,
      lastExecution:
        executions.length > 0
          ? executions[executions.length - 1].attemptedAt
          : null,
    };
  }

  clearHistory() {
    this.screeningHistory.clear();
    this.executionResults.clear();
    console.log("🧹 History cleared");
  }
}
