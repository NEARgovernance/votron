import { agent, agentCall } from "@neardefi/shade-agent-js";
import {
  queuedAgentCall,
  queuedAgent,
  queuedAgentAccountId,
} from "./agentQueue";

export interface ScreeningCriteria {
  trustedProposers?: string[];
  blockedProposers?: string[];
  apiKey?: string;
  agentAccountId?: string;
  votingContractId?: string;
}

export interface ScreeningResult {
  proposalId: string;
  approved: boolean;
  reasons: string[];
  timestamp: string;
  executionResult?: ExecutionResult;
}

export interface ExecutionStatus {
  executed: boolean;
  executionTxHash?: string;
  executedAt?: string;
  success: boolean;
  executionError?: string;
  attemptedAt?: string;
}

export interface ExecutionResult {
  action: "approved" | "failed";
  transactionHash?: string;
  timestamp: string;
  error?: string;
}

export interface ProposalData {
  title?: string;
  description?: string;
  proposer_id?: string;
  budget?: number;
  [key: string]: any;
}

export class ProposalScreener {
  private criteria: ScreeningCriteria;
  private screeningHistory: Map<string, ScreeningResult>;
  private executionResults: Map<string, ExecutionStatus>;

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
      initialCriteria.votingContractId ||
      process.env.VOTING_CONTRACT_ID ||
      "shade.ballotbox.testnet";
    this.screeningHistory = new Map();
    this.executionResults = new Map();

    console.log(
      `🛡️ AI Proposal screener initialized (Anthropic ${
        this.criteria.apiKey ? "✅" : "❌"
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

  public async askAI(
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
    if (result.approved) {
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
      const result = await this.executeViaAgentContract(proposalId);

      // Store execution result
      this.executionResults.set(proposalId, {
        executed: true,
        executionTxHash: result.transactionHash,
        executedAt: new Date().toISOString(),
        success: true,
      });

      return result;
    } catch (error: any) {
      console.error(`❌ Approval failed:`, error.message);

      this.executionResults.set(proposalId, {
        executed: false,
        executionError: error.message,
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
      `🤖 Executing ONLY approve_proposal for proposal ${proposalId} via QUEUE...`
    );

    try {
      const result = await queuedAgentCall({
        methodName: "approve_proposal",
        args: {
          proposal_id: parseInt(proposalId),
          voting_start_time_sec: null,
        },
      });

      console.log(
        `✅ approve_proposal result:`,
        JSON.stringify(result, null, 2)
      );
      console.log(`🔍 Result keys:`, Object.keys(result || {}));
      console.log(`🔍 Transaction hash checks:`, {
        "result.transaction?.hash": result.transaction?.hash,
        "result.txHash": result.txHash,
        "result.receipt?.transaction_hash": result.receipt?.transaction_hash,
        "result.receipt?.id": result.receipt?.id,
        "result.hash": result.hash,
        "result.transaction_outcome?.id": result.transaction_outcome?.id,
      });

      if (result.transaction?.hash || result.txHash) {
        console.log(
          `🎉 SUCCESS! Real transaction hash: ${
            result.transaction?.hash || result.txHash
          }`
        );
        return {
          action: "approved",
          transactionHash: result.transaction?.hash || result.txHash,
          timestamp: new Date().toISOString(),
        };
      } else if (result.error) {
        throw new Error(`Contract error: ${result.error}`);
      } else {
        const fallbackHash =
          result.receipt?.transaction_hash ||
          result.receipt?.id ||
          result.hash ||
          result.transaction_outcome?.id ||
          `success_${Date.now()}`;

        console.log(`⚠️ Using fallback transaction hash: ${fallbackHash}`);
        console.log(
          `🔍 Full result structure:`,
          JSON.stringify(result, null, 2)
        );

        return {
          action: "approved",
          transactionHash: fallbackHash,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error: any) {
      console.error(`❌ approve_proposal failed:`, error);
      throw error;
    }
  }

  async testContractConnection(): Promise<boolean> {
    try {
      const accountInfo = await queuedAgentAccountId();

      await queuedAgent("view", {
        contractId: "ac-sandbox.votron.testnet",
        methodName: "get_agent",
        args: { account_id: accountInfo.accountId },
      });
      return true;
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

    if (this.screeningHistory.size > 1000) {
      const entries = Array.from(this.screeningHistory.entries());
      const oldest = entries.sort(
        (a, b) =>
          new Date(a[1].timestamp).getTime() -
          new Date(b[1].timestamp).getTime()
      )[0];
      this.screeningHistory.delete(oldest[0]);
    }

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
