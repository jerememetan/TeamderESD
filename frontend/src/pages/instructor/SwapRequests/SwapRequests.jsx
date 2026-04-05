import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import { Button } from "../../../components/ui/button";
import { backendSectionIds } from "../../../data/backendIds";
import {
  decideSwapReviewRequest,
  fetchSwapReviewRequests,
} from "../../../services/swapRequestService";
import { filterRequests } from "./logic/swapRequestLogic";
import chrome from "../../../styles/instructorChrome.module.css";
import styles from "./SwapRequests.module.css";

function SwapRequests() {
  const fallbackSectionId = backendSectionIds["1-g1"];
  const sectionId =
    import.meta.env.VITE_INSTRUCTOR_SWAP_SECTION_ID ?? fallbackSectionId;

  const [requestList, setRequestList] = useState([]);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      if (!sectionId) {
        setErrorMessage(
          "Missing section mapping. Set VITE_INSTRUCTOR_SWAP_SECTION_ID to a valid section UUID.",
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      try {
        const data = await fetchSwapReviewRequests({ sectionId });
        if (!isMounted) {
          return;
        }

        const rows = Array.isArray(data?.requests) ? data.requests : [];
        const normalized = rows.map((request) => ({
          ...request,
          status: String(request?.status || "pending").toLowerCase(),
        }));
        setRequestList(normalized);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(error?.message || "Failed to load swap requests.");
        setRequestList([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRequests();
    return () => {
      isMounted = false;
    };
  }, [sectionId]);

  const filteredRequests = useMemo(
    () => filterRequests(requestList, filter),
    [requestList, filter],
  );

  async function updateDecision(requestId, decision) {
    setIsUpdating(true);
    setErrorMessage("");
    try {
      await decideSwapReviewRequest({
        swapRequestId: requestId,
        decision,
      });
      setRequestList((currentRequests) =>
        currentRequests.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: decision === "APPROVED" ? "approved" : "rejected",
              }
            : request,
        ),
      );
    } catch (error) {
      setErrorMessage(error?.message || "Failed to update request decision.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className={styles.page}>
      <Link to="/instructor" className={chrome.backLink}>
        <ArrowLeft className={chrome.backIcon} />
        Back to Dashboard
      </Link>

      <section className={chrome.hero}>
        <div>
          <p className={chrome.kicker}>[SWAP REQUESTS]</p>
          <h2 className={chrome.title}>Review swap requests</h2>
          <p className={chrome.subtitle}>
            Approve or reject team change requests for your course groups.
          </p>
        </div>
        <SystemTag tone="neutral">
          {requestList.filter((request) => request.status === "pending").length}{" "}
          pending
        </SystemTag>
      </section>

      {errorMessage ? (
        <ModuleBlock
          componentId="MOD-SWERR"
          eyebrow="Integration"
          title="Swap request backend unavailable"
          metric="!"
          metricLabel="Action required"
        >
          <p className={styles.reasonText}>{errorMessage}</p>
        </ModuleBlock>
      ) : null}

      <div className={chrome.toolbar}>
        {["all", "pending", "approved", "rejected"].map((status) => (
          <Button
            key={status}
            onClick={() => setFilter(status)}
            variant={filter === status ? "default" : "outline"}
            size="sm"
          >
            <span>{status === "all" ? "All requests" : status}</span>
            {status !== "all" ? (
              <span className={chrome.toolbarCount}>
                {
                  requestList.filter((request) => request.status === status)
                    .length
                }
              </span>
            ) : null}
          </Button>
        ))}
      </div>

      <div className={styles.requestList}>
        {isLoading ? (
          <ModuleBlock
            componentId="MOD-SWLOAD"
            eyebrow="Queue State"
            title="Loading swap requests"
            metric=".."
            metricLabel="Fetching"
          />
        ) : filteredRequests.length === 0 ? (
          <ModuleBlock
            componentId="MOD-SW0"
            eyebrow="Queue State"
            title="No swap requests"
            metric="00"
            metricLabel="Visible requests"
          />
        ) : (
          filteredRequests.map((request, index) => (
            <ModuleBlock
              key={request.id}
              componentId={`MOD-SW${index + 1}`}
              eyebrow={request.studentName}
              title={request.courseName}
              accent={
                request.status === "pending"
                  ? "orange"
                  : request.status === "approved"
                    ? "green"
                    : "blue"
              }
              actions={
                request.status === "pending" ? (
                  <>
                    <Button
                      onClick={() => updateDecision(request.id, "APPROVED")}
                      variant="success"
                      size="sm"
                      disabled={isUpdating}
                    >
                      <CheckCircle className={chrome.buttonIcon} /> Approve
                    </Button>
                    <Button
                      onClick={() => updateDecision(request.id, "REJECTED")}
                      variant="warning"
                      size="sm"
                      disabled={isUpdating}
                    >
                      <XCircle className={chrome.buttonIcon} /> Reject
                    </Button>
                  </>
                ) : null
              }
            >
              <div className={styles.requestMeta}>
                {request.status === "pending" ? (
                  <SystemTag hazard>Pending review</SystemTag>
                ) : null}
                {request.status === "approved" ? (
                  <SystemTag tone="success">Approved</SystemTag>
                ) : null}
                {request.status === "rejected" ? (
                  <SystemTag tone="alert">Rejected</SystemTag>
                ) : null}
                <p className={chrome.metaPill}>
                  Current team | {request.currentTeamName}
                </p>
                <p className={chrome.metaPill}>
                  Submitted | {new Date(request.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className={styles.reasonBox}>
                <p className={styles.reasonLabel}>Student note</p>
                <p className={styles.reasonText}>{request.reason}</p>
              </div>
            </ModuleBlock>
          ))
        )}
      </div>
    </div>
  );
}

export default SwapRequests;
