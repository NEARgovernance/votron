export function ProposalCard({ proposal, compact = false }) {
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

  return (
    <div className={`card ${compact ? "mb-2" : "mb-3"}`}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start">
          <div className="flex-grow-1">
            <h6 className={`card-title ${compact ? "mb-1" : "mb-2"}`}>
              #{proposal.id}: {proposal.title}
              <span className="ms-2">{getStatusBadge(proposal.status)}</span>
            </h6>
            <div className="text-muted small mb-1">
              by <code>{proposal.proposer_id}</code>
            </div>
            <div className="text-muted small mb-2">
              from <code>{proposal.contractId}</code>
              {proposal.factoryName ? <> ({proposal.factoryName})</> : null}
            </div>
            {!compact && proposal.description && (
              <p className="card-text small text-secondary">
                {proposal.description.length > 120
                  ? `${proposal.description.substring(0, 120)}...`
                  : proposal.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
