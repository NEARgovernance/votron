export function ProposalCard({ proposal, compact = false, agentExecution }) {
  const getStatusBadge = (status) => {
    const statusConfig = {
      Created: { class: "bg-warning text-dark", text: "Pending" },
      Rejected: { class: "bg-danger", text: "Rejected" },
      Approved: { class: "bg-primary", text: "Approved" },
      Voting: { class: "bg-success", text: "Active" },
      Finished: { class: "bg-dark", text: "Finished" },
    };

    const config = statusConfig[status] || {
      class: "bg-secondary",
      text: status,
    };

    return <span className={`badge ${config.class}`}>{config.text}</span>;
  };

  const getAgentExecutionBadge = (execution) => {
    if (!execution) {
      return (
        <span className="badge bg-light text-dark ms-2">🤖 Not Processed</span>
      );
    }

    if (execution.executed === false) {
      return <span className="badge bg-danger ms-2">🤖 Processing Failed</span>;
    }

    return (
      <span
        className={`badge ${
          execution.success ? "bg-success" : "bg-warning"
        } ms-2`}
      >
        🤖 {execution.success ? "Auto-Approved" : "Error"}
      </span>
    );
  };

  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className={`card ${compact ? "mb-2" : "mb-3"}`}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start">
          <div className="flex-grow-1">
            <h6 className={`card-title ${compact ? "mb-1" : "mb-2"}`}>
              #{proposal.id}: {proposal.title}
              <span className="ms-2">{getStatusBadge(proposal.status)}</span>
              {getAgentExecutionBadge(agentExecution)}
            </h6>

            <div className="text-muted small mb-1">
              by <code>{proposal.proposer_id}</code>
            </div>

            <div className="text-muted small mb-2">
              from <code>{proposal.contractId}</code>
              {proposal.factoryName ? <> ({proposal.factoryName})</> : null}
            </div>

            {/* AGENT EXECUTION DETAILS */}
            {agentExecution && !compact && (
              <div className="mb-2">
                <div
                  className={`alert ${
                    agentExecution.success ? "alert-success" : "alert-danger"
                  } py-2 mb-2`}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <strong>🤖 Shade Agent Processing:</strong>
                      <span
                        className={`badge ${
                          agentExecution.success ? "bg-success" : "bg-danger"
                        } ms-2`}
                      >
                        {agentExecution.executed === false
                          ? "PROCESSING FAILED"
                          : agentExecution.success
                          ? "AUTO-APPROVED"
                          : "ERROR"}
                      </span>
                      <br />

                      {/* Execution method */}
                      {agentExecution.executionMethod && (
                        <>
                          <small>
                            <strong>Method:</strong>{" "}
                            {agentExecution.executionMethod.replace("_", " ")}
                          </small>
                          <br />
                        </>
                      )}

                      {/* Error details */}
                      {agentExecution.executionError && (
                        <>
                          <small>
                            <strong>Error:</strong>{" "}
                            {agentExecution.executionError}
                          </small>
                          <br />
                        </>
                      )}

                      {/* Transaction hash */}
                      {agentExecution.executionTxHash && (
                        <>
                          <small>
                            <strong>Transaction:</strong>{" "}
                            <a
                              href={`https://explorer.testnet.near.org/transactions/${agentExecution.executionTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-decoration-none"
                            >
                              {agentExecution.executionTxHash.substring(0, 12)}
                              ... ↗
                            </a>
                          </small>
                          <br />
                        </>
                      )}

                      {/* Timestamp */}
                      <small className="text-muted">
                        {agentExecution.executed === false
                          ? "Attempted"
                          : "Executed"}
                        :{" "}
                        {formatTimestamp(
                          agentExecution.executedAt ||
                            agentExecution.attemptedAt
                        )}
                      </small>

                      {/* Agent logs if available */}
                      {agentExecution.logs &&
                        agentExecution.logs.length > 0 && (
                          <div className="mt-2 pt-2 border-top">
                            <small>
                              <strong>📋 Agent Logs:</strong>
                              <div className="mt-1">
                                {agentExecution.logs
                                  .slice(0, 3)
                                  .map((log, i) => (
                                    <div key={i} className="text-muted small">
                                      • {log}
                                    </div>
                                  ))}
                              </div>
                            </small>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Original proposal description */}
            {!compact && proposal.description && (
              <p className="card-text small text-secondary">
                {proposal.description.length > 120
                  ? `${proposal.description.substring(0, 120)}...`
                  : proposal.description}
              </p>
            )}

            {/* Voting/Timeline info if available */}
            {!compact && (proposal.voting_end || proposal.deadline) && (
              <div className="text-muted small">
                {proposal.voting_end && (
                  <span>
                    Voting ends: {formatTimestamp(proposal.voting_end)}
                  </span>
                )}
                {proposal.deadline && (
                  <span>Deadline: {formatTimestamp(proposal.deadline)}</span>
                )}
              </div>
            )}

            {/* Agent status indicators for compact view */}
            {compact && agentExecution && (
              <div className="mt-2">
                <small className="text-muted">
                  🤖 Agent:{" "}
                  {agentExecution.success ? "✅ Approved" : "❌ Failed"}
                  {agentExecution.executionTxHash && (
                    <>
                      {" "}
                      | TX:{" "}
                      <code>
                        {agentExecution.executionTxHash.substring(0, 8)}...
                      </code>
                    </>
                  )}
                </small>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
