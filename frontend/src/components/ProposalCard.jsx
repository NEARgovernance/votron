export function ProposalCard({ proposal, compact = false, screeningResult }) {
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

  const getAIScreeningBadge = (result) => {
    if (!result) {
      return (
        <span className="badge bg-light text-dark ms-2">🤖 Not Screened</span>
      );
    }

    return (
      <span
        className={`badge ${result.approved ? "bg-success" : "bg-danger"} ms-2`}
      >
        🤖 {result.approved ? "AI Approved" : "AI Rejected"}
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
              {getAIScreeningBadge(screeningResult)}
            </h6>

            <div className="text-muted small mb-1">
              by <code>{proposal.proposer_id}</code>
            </div>

            <div className="text-muted small mb-2">
              from <code>{proposal.contractId}</code>
              {proposal.factoryName ? <> ({proposal.factoryName})</> : null}
            </div>

            {/* AI SCREENING DETAILS */}
            {screeningResult && !compact && (
              <div className="mb-2">
                <div
                  className={`alert ${
                    screeningResult.approved ? "alert-success" : "alert-danger"
                  } py-2 mb-2`}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <strong>🤖 AI Screening Result:</strong>
                      <span
                        className={`badge ${
                          screeningResult.approved ? "bg-success" : "bg-danger"
                        } ms-2`}
                      >
                        {screeningResult.approved ? "APPROVED" : "REJECTED"}
                      </span>
                      <br />
                      <small>
                        <strong>Reasons:</strong>{" "}
                        {Array.isArray(screeningResult.reasons)
                          ? screeningResult.reasons.join(" • ")
                          : "No reasons provided"}
                      </small>
                      <br />
                      <small className="text-muted">
                        Screened: {formatTimestamp(screeningResult.timestamp)}
                      </small>
                    </div>
                  </div>

                  {/* Show execution result if autonomous action was taken */}
                  {screeningResult.executionResult && (
                    <div className="mt-2 pt-2 border-top">
                      <small>
                        <strong>🤖 Autonomous Action:</strong>{" "}
                        {screeningResult.executionResult.action}
                        {screeningResult.executionResult.transactionHash && (
                          <>
                            {" | "}
                            <a
                              href={`https://explorer.testnet.near.org/transactions/${screeningResult.executionResult.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-decoration-none"
                            >
                              View Transaction ↗
                            </a>
                          </>
                        )}
                        <br />
                        <span className="text-muted">
                          Executed:{" "}
                          {formatTimestamp(
                            screeningResult.executionResult.timestamp
                          )}
                        </span>
                      </small>
                    </div>
                  )}
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
          </div>
        </div>
      </div>
    </div>
  );
}
