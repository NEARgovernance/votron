import { agent, agentAccountId } from "@neardefi/shade-agent-js";

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
    this.customContractId = process.env.CUSTOM_CONTRACT_ID;
    this.autonomousMode = !!(this.agentAccountId && this.votingContractId);
    this.screeningHistory = new Map();

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

  private async askAI(proposal: ProposalData): Promise<{
    approved: boolean;
    reasons: string[];
  }> {
    console.log(
      "🧪 ANTHROPIC_API_KEY exists:",
      !!process.env.ANTHROPIC_API_KEY
    );

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error(`❌ No Anthropic API key found in environment`);
      console.error(`❌ All env keys:`, Object.keys(process.env).slice(0, 10));
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
      console.log(
        `🔗 Using API endpoint: https://api.anthropic.com/v1/messages`
      );

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
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      console.log(`📡 Anthropic API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`🤖 Anthropic API Error ${response.status}:`, errorText);

        // Try to parse error details
        try {
          const errorData = JSON.parse(errorText);
          console.error(`🤖 Parsed error:`, errorData);
        } catch {
          console.error(`🤖 Raw error:`, errorText);
        }

        throw new Error(
          `Anthropic API error: ${response.status} ${
            response.statusText
          } - ${errorText.substring(0, 200)}`
        );
      }

      const data = await response.json();
      console.log(`🤖 Claude response data:`, data);

      const aiResponse = data.content[0].text;
      console.log(`🤖 Claude response text:`, aiResponse);

      return this.parseAIResponse(aiResponse);
    } catch (error: any) {
      console.error("🤖 AI API call failed:", error);

      // More specific error handling
      if (error.message.includes("401")) {
        throw new Error(`Invalid Anthropic API key`);
      } else if (error.message.includes("429")) {
        throw new Error(`Anthropic API rate limit exceeded`);
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error(
          `Network error connecting to Anthropic API: ${error.message}`
        );
      } else {
        throw new Error(`AI screening failed: ${error.message}`);
      }
    }
  }

  private parseAIResponse(response: string): {
    approved: boolean;
    reasons: string[];
  } {
    try {
      // Try to extract JSON from the response
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

      // Fallback: look for approve/reject in text
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

  shouldExecuteAction(screeningResult: ScreeningResult): boolean {
    return screeningResult.approved;
  }

  private async executeDecision(
    proposalId: string,
    screeningResult: ScreeningResult
  ): Promise<ExecutionResult | null> {
    if (!this.agentAccountId || !this.votingContractId) {
      throw new Error("Agent account or voting contract not configured");
    }

    const { approved } = screeningResult;

    if (approved) {
      console.log(
        `🤖 Executing autonomous APPROVAL for proposal ${proposalId}`
      );
      return await this.approveProposal(proposalId);
    } else {
      console.log(`🤖 Proposal ${proposalId} not approved - no action taken`);
      return null;
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

        if (executionResult) {
          result.executionResult = executionResult;
          result.reasons.push(
            `🤖 Autonomous action: ${executionResult.action}`
          );
          console.log(
            `✅ Autonomous execution completed for proposal ${result.proposalId}`
          );
        } else {
          console.log(
            `⏸️ No autonomous action taken for proposal ${result.proposalId}`
          );
          result.reasons.push(`⏸️ No action taken - proposal not approved`);
        }

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

    try {
      const teeUrl =
        process.env.API_URL ||
        "https://a5157c8328f314eaca02a9d57925d470536b7b8a-3000.dstack-prod7.phala.network";

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
      console.log(`✅ Successfully approved proposal ${proposalId}`, result);

      return {
        action: "approved",
        transactionHash: result.transactionHash,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ TEE approval failed:`, error.message);
      return {
        action: "failed",
        transactionHash: `simulated_approve_${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
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
    const decisionText = approved
      ? "APPROVE & EXECUTE"
      : "NOT APPROVED (no action)";
    console.log(`${emoji} Proposal ${proposalId}: ${decisionText}`);
    console.log(`   Reasons: ${reasons.join(" | ")}`);

    return result;
  }

  getScreeningHistory(): ScreeningResult[] {
    return Array.from(this.screeningHistory.values());
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
