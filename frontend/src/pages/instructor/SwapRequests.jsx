import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle, Clock, XCircle } from "lucide-react";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import { mockSwapRequests } from "../../data/mockData";
import styles from "./SwapRequests.module.css";

function SwapRequests() {
  const [requestList, setRequestList] = useState(mockSwapRequests);
  const [filter, setFilter] = useState("all");

  const filteredRequests = filter === "all"
    ? requestList
    : requestList.filter((request) => request.status === filter);

  const handleApprove = (requestId) => {
    setRequestList((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId ? { ...request, status: "approved" } : request,
      ),
    );
  };

  const handleReject = (requestId) => {
    setRequestList((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId ? { ...request, status: "rejected" } : request,
      ),
    );
  };

  return (
    <div className={styles.page}>
      <Link to="/instructor" className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} />
        Back to Dashboard
      </Link>

      <section className={styles.hero}>
        <div>
          <h2 className={styles.title}>Review Student's Swap Requests</h2>
        </div>
        <SystemTag hazard>Live intervention channel</SystemTag>
      </section>

      <div className={styles.filterRow}>
        {["all", "pending", "approved", "rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`${styles.filterButton} ${filter === status ? styles.activeFilter : ''}`}
          >
            <span>{status === 'all' ? 'All requests' : status}</span>
            {status !== 'all' ? (
              <span className={styles.filterCount}>{requestList.filter((request) => request.status === status).length}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className={styles.requestList}>
        {filteredRequests.length === 0 ? (
          <ModuleBlock componentId="MOD-SW0" eyebrow="Queue State" title="No swap requests" metric="00" metricLabel="Visible requests" />
        ) : (
          filteredRequests.map((request, index) => (
            <ModuleBlock
              key={request.id}
              componentId={`MOD-SW${index + 1}`}
              eyebrow={request.studentName}
              title={request.courseName}
              accent={request.status === 'pending' ? 'orange' : request.status === 'approved' ? 'green' : 'blue'}
              actions={
                request.status === 'pending' ? (
                  <>
                    <button onClick={() => handleApprove(request.id)} className={styles.approveButton}>
                      <CheckCircle className={styles.buttonIcon} /> Approve
                    </button>
                    <button onClick={() => handleReject(request.id)} className={styles.rejectButton}>
                      <XCircle className={styles.buttonIcon} /> Reject
                    </button>
                  </>
                ) : null
              }
            >
              <div className={styles.requestMeta}>
                {request.status === 'pending' ? <SystemTag hazard>Pending intervention</SystemTag> : null}
                {request.status === 'approved' ? <SystemTag tone="success">Approved</SystemTag> : null}
                {request.status === 'rejected' ? <SystemTag tone="alert">Rejected</SystemTag> : null}
                <p className={styles.metaLine}>Current team :: {request.currentTeamName}</p>
                <p className={styles.metaLine}>Submitted :: {new Date(request.createdAt).toLocaleDateString()}</p>
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
