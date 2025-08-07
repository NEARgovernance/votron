import { useState, useMemo } from "react";
import { useProposals } from "../hooks/useProposals.js";
import { ProposalCard } from "../components/ProposalCard.jsx";
import { Constants } from "../hooks/constants.js";

const PROPOSALS_PER_PAGE = 10;

export function Proposals({ accountId }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Get current proposals
  const { proposals, loading, error, refetch } = useProposals(
    Constants.VOTING_CONTRACT_ID
  );

  // Filter proposals by status
  const filteredProposals = useMemo(() => {
    if (statusFilter === "all") return proposals;

    const statusMap = {
      active: ["Voting"],
      pending: ["Created"],
      finished: ["Finished", "Approved", "Rejected"],
    };

    return proposals.filter((proposal) =>
      statusMap[statusFilter]?.includes(proposal.status)
    );
  }, [proposals, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredProposals.length / PROPOSALS_PER_PAGE);
  const startIndex = (currentPage - 1) * PROPOSALS_PER_PAGE;
  const paginatedProposals = filteredProposals.slice(
    startIndex,
    startIndex + PROPOSALS_PER_PAGE
  );

  // Get counts for each status
  const statusCounts = useMemo(() => {
    return {
      all: proposals.length,
      active: proposals.filter((p) => p.status === "Voting").length,
      pending: proposals.filter((p) => p.status === "Created").length,
      finished: proposals.filter((p) =>
        ["Finished", "Approved", "Rejected"].includes(p.status)
      ).length,
    };
  }, [proposals]);

  const handleFilterChange = (newFilter) => {
    setStatusFilter(newFilter);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading proposals...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="panel">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="mb-1">📋 On-Chain Proposals</h2>
            <p className="text-muted mb-0">
              Contract: <code>{Constants.VOTING_CONTRACT_ID}</code>
            </p>
          </div>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={refetch}
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card text-center">
              <div className="card-body">
                <h4 className="card-title text-primary">{statusCounts.all}</h4>
                <p className="card-text small">Total Proposals</p>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center">
              <div className="card-body">
                <h4 className="card-title text-success">
                  {statusCounts.active}
                </h4>
                <p className="card-text small">Active Voting</p>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center">
              <div className="card-body">
                <h4 className="card-title text-warning">
                  {statusCounts.pending}
                </h4>
                <p className="card-text small">Pending Review</p>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center">
              <div className="card-body">
                <h4 className="card-title text-dark">
                  {statusCounts.finished}
                </h4>
                <p className="card-text small">Completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="d-flex flex-wrap gap-2 mb-4">
          <button
            className={`btn ${
              statusFilter === "all" ? "btn-primary" : "btn-outline-primary"
            } btn-sm`}
            onClick={() => handleFilterChange("all")}
          >
            All ({statusCounts.all})
          </button>
          <button
            className={`btn ${
              statusFilter === "active" ? "btn-success" : "btn-outline-success"
            } btn-sm`}
            onClick={() => handleFilterChange("active")}
          >
            🗳️ Active ({statusCounts.active})
          </button>
          <button
            className={`btn ${
              statusFilter === "pending" ? "btn-warning" : "btn-outline-warning"
            } btn-sm`}
            onClick={() => handleFilterChange("pending")}
          >
            ⏳ Pending ({statusCounts.pending})
          </button>
          <button
            className={`btn ${
              statusFilter === "finished" ? "btn-dark" : "btn-outline-dark"
            } btn-sm`}
            onClick={() => handleFilterChange("finished")}
          >
            ✅ Finished ({statusCounts.finished})
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="alert alert-danger mb-4">
            <h6>Error loading proposals:</h6>
            <p className="mb-0">{error}</p>
          </div>
        )}

        {/* Proposals List */}
        {filteredProposals.length === 0 ? (
          <div className="text-center py-5">
            <div className="text-muted">
              <h5>
                No {statusFilter === "all" ? "" : statusFilter} proposals found
              </h5>
              <p>
                {statusFilter === "active" &&
                  "No proposals are currently accepting votes."}
                {statusFilter === "pending" &&
                  "No proposals are awaiting review."}
                {statusFilter === "finished" &&
                  "No proposals have been completed yet."}
                {statusFilter === "all" &&
                  "No proposals have been created yet. Be the first to submit one!"}
              </p>
              {statusFilter === "all" && accountId && (
                <button className="btn btn-primary mt-2">
                  Create First Proposal
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Proposals */}
            <div className="mb-4">
              {paginatedProposals.map((proposal) => (
                <ProposalCard
                  key={`${proposal.contractId}-${proposal.id}`}
                  proposal={proposal}
                  compact={false}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="d-flex justify-content-center">
                <nav aria-label="Proposals pagination">
                  <ul className="pagination pagination-sm">
                    {currentPage > 1 && (
                      <li className="page-item">
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(currentPage - 1)}
                        >
                          Previous
                        </button>
                      </li>
                    )}

                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let page;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }

                      return (
                        <li
                          key={page}
                          className={`page-item ${
                            currentPage === page ? "active" : ""
                          }`}
                        >
                          <button
                            className="page-link"
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </button>
                        </li>
                      );
                    })}

                    {currentPage < totalPages && (
                      <li className="page-item">
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(currentPage + 1)}
                        >
                          Next
                        </button>
                      </li>
                    )}
                  </ul>
                </nav>
              </div>
            )}

            <div className="text-center text-muted small">
              Showing {startIndex + 1}-
              {Math.min(
                startIndex + PROPOSALS_PER_PAGE,
                filteredProposals.length
              )}{" "}
              of {filteredProposals.length} proposals
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Proposals;
