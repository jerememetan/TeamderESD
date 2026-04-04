import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import { Button } from "../../../components/ui/button";
import { mockSwapRequests } from "../../../data/mockData";
import {
  filterRequests,
  handleApprove,
  handleReject,
} from "./logic/swapRequestLogic";
import chrome from "../../../styles/instructorChrome.module.css";
import styles from "./SwapRequests.module.css";

function SwapRequests() {
  const [requestList, setRequestList] = useState(mockSwapRequests);
  const [filter, setFilter] = useState("all");

  const filteredRequests = filterRequests(requestList, filter);

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
        {filteredRequests.length === 0 ? (
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
                      onClick={() => handleApprove(request.id, setRequestList)}
                      variant="success"
                      size="sm"
                    >
                      <CheckCircle className={chrome.buttonIcon} /> Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(request.id, setRequestList)}
                      variant="warning"
                      size="sm"
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
