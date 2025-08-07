import { near } from "./fastnear.js";
import { useState, useEffect, useCallback } from "react";

export function useProposals(contractId) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProposals = useCallback(async () => {
    if (!contractId) {
      setProposals([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (typeof near === "undefined") {
        const sampleProposals = Array.from({ length: 5 }, (_, i) => ({
          id: i,
          title: `Sample Proposal #${i + 1}`,
          description: `This is a sample proposal description for proposal ${
            i + 1
          }`,
          status: ["Created", "Voting", "Approved", "Rejected"][
            Math.floor(Math.random() * 4)
          ],
          proposer_id: "user.testnet",
          created_at: Date.now() - Math.random() * 86400000 * 7,
          contractId,
        }));
        setProposals(sampleProposals);
        setLoading(false);
        return;
      }

      // Get total number of proposals
      const numProposals = await near.view({
        contractId,
        methodName: "get_num_proposals",
        args: {},
      });

      console.log(`📊 Found ${numProposals} proposals in ${contractId}`);

      if (!numProposals || numProposals === 0) {
        setProposals([]);
        setLoading(false);
        return;
      }

      // Fetch the last 50 proposals (most recent)
      const startIdx = Math.max(0, numProposals - 50);
      const proposalIds = Array.from(
        { length: numProposals - startIdx },
        (_, i) => startIdx + i
      );

      // Fetch all proposals
      const results = await Promise.allSettled(
        proposalIds.map(async (id) => {
          const proposal = await near.view({
            contractId,
            methodName: "get_proposal",
            args: { proposal_id: id },
          });
          return {
            ...proposal,
            id,
            contractId,
          };
        })
      );

      // Filter successful results and sort by creation date
      const fetchedProposals = results
        .filter((res) => res.status === "fulfilled")
        .map((res) => res.value)
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

      setProposals(fetchedProposals);
    } catch (err) {
      console.error(`Error fetching proposals from ${contractId}:`, err);
      setError(err.message || "Failed to fetch proposals");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return {
    proposals,
    loading,
    error,
    refetch: fetchProposals,
  };
}
