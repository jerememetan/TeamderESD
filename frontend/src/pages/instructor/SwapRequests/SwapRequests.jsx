import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import { Button } from "../../../components/ui/button";
import { fetchAllSections } from "../../../services/sectionService";
import {
  decideSwapReviewRequest,
  fetchSwapReviewRequests,
} from "../../../services/swapRequestService";
import { filterRequests } from "./logic/swapRequestLogic";
import chrome from "../../../styles/instructorChrome.module.css";
import styles from "./SwapRequests.module.css";

function SwapRequests() {
  const configuredSectionId = import.meta.env.VITE_INSTRUCTOR_SWAP_SECTION_ID;

  const [requestList, setRequestList] = useState([]);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const sections = await fetchAllSections();
        const sectionRows = Array.isArray(sections) ? sections : [];

        const targetSections = configuredSectionId
          ? sectionRows.filter(
              (section) =>
                String(section?.id || "") === String(configuredSectionId),
            )
          : sectionRows;

        if (!targetSections.length) {
          throw new Error(
            configuredSectionId
              ? "Configured section was not found. Check VITE_INSTRUCTOR_SWAP_SECTION_ID."
              : "No sections found for swap request review.",
          );
        }

        const settled = await Promise.allSettled(
          targetSections.map(async (section) => {
            const sectionId = String(section?.id || "");
            const data = await fetchSwapReviewRequests({ sectionId });
            const rows = Array.isArray(data?.requests) ? data.requests : [];
            const resolvedSection = data?.section ?? {};

            return rows.map((request) => ({
              ...request,
              sectionId: String(
                request?.sectionId || resolvedSection?.id || sectionId,
              ),
              sectionNumber:
                request?.sectionNumber ??
                resolvedSection?.section_number ??
                section?.section_number,
              status: String(request?.status || "pending").toLowerCase(),
            }));
          }),
        );

        if (!isMounted) {
          return;
        }

        const normalized = settled
          .filter((result) => result.status === "fulfilled")
          .flatMap((result) => result.value);

        normalized.sort((a, b) => {
          const left = Date.parse(a?.createdAt || "") || 0;
          const right = Date.parse(b?.createdAt || "") || 0;
          return right - left;
        });

        setRequestList(normalized);

        const failedCount = settled.filter(
          (result) => result.status === "rejected",
        ).length;
        if (failedCount > 0) {
          setErrorMessage(
            `Loaded requests from ${settled.length - failedCount} section(s); ${failedCount} section(s) failed to load.`,
          );
        }
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
  }, [configuredSectionId]);

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
            Approve or reject team change requests across your available
            sections.
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
                  Section |{" "}
                  {request.sectionNumber
                    ? `G${request.sectionNumber}`
                    : request.sectionId}
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
