import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import ModuleBlock from '../../../components/schematic/ModuleBlock';
import SystemTag from '../../../components/schematic/SystemTag';
import { Button } from '../../../components/ui/button';
import chrome from '../../../styles/instructorChrome.module.css';
import styles from './ErrorLogs.module.css';
import { deleteErrorLog, fetchErrorLogs } from '../../../services/errorLogService';

function formatContext(contextJson) {
  if (!contextJson) {
    return 'No context payload was recorded.';
  }

  try {
    return JSON.stringify(contextJson, null, 2);
  } catch {
    return String(contextJson);
  }
}

function ErrorLogs() {
  const [logs, setLogs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const visibleSources = useMemo(
    () => Array.from(new Set(logs.map((log) => log.source_service).filter(Boolean))).sort(),
    [logs],
  );

  const loadLogs = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage('');

    try {
      const nextLogs = await fetchErrorLogs({
        status: statusFilter,
        sourceService: sourceFilter || undefined,
      });
      setLogs(nextLogs);
    } catch (error) {
      setErrorMessage(error.message);
      setLogs([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [sourceFilter, statusFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleDelete = async (logId) => {
    const confirmed = window.confirm('Delete this error log? This will mark the row as DELETED.');
    if (!confirmed) {
      return;
    }

    try {
      await deleteErrorLog(logId);
      await loadLogs({ silent: true });
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <div className={styles.page}>
      <Link to="/instructor" className={chrome.backLink}>
        <ArrowLeft className={chrome.backIcon} />
        Back to Dashboard
      </Link>

      <section className={chrome.hero}>
        <div>
          <p className={chrome.kicker}>[ERROR LOGS]</p>
          <h2 className={chrome.title}>Review service failures</h2>
          <p className={chrome.subtitle}>
            Inspect RabbitMQ error events and remove entries after triage.
          </p>
        </div>
        <SystemTag hazard>{logs.length} visible</SystemTag>
      </section>

      <div className={chrome.toolbar}>
        {['all', 'OPEN', 'DELETED'].map((status) => (
          <Button
            key={status}
            onClick={() => setStatusFilter(status)}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
          >
            <span>{status === 'all' ? 'All logs' : status}</span>
          </Button>
        ))}
        <Button onClick={() => loadLogs({ silent: true })} variant="outline" size="sm">
          <RefreshCw className={chrome.buttonIcon} />
          {isRefreshing ? 'Refreshing' : 'Refresh'}
        </Button>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Source service</span>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className={styles.select}
          >
            <option value="">All sources</option>
            {visibleSources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errorMessage ? (
        <ModuleBlock componentId="MOD-ERR0" eyebrow="Load Error" title="Unable to load logs" accent="orange">
          <p className={styles.errorText}>{errorMessage}</p>
        </ModuleBlock>
      ) : null}

      <div className={styles.logList}>
        {isLoading ? (
          <ModuleBlock componentId="MOD-ERR1" eyebrow="Loading" title="Fetching error logs" metric="..." metricLabel="Records" />
        ) : logs.length === 0 ? (
          <ModuleBlock componentId="MOD-ERR2" eyebrow="Queue State" title="No error logs" metric="00" metricLabel="Visible records">
            <p className={styles.emptyText}>No error events match the current filters.</p>
          </ModuleBlock>
        ) : (
          logs.map((log, index) => (
            <ModuleBlock
              key={log.id}
              componentId={`MOD-ERR${index + 10}`}
              eyebrow={`#${log.id}`}
              title={log.error_message}
              accent={log.status === 'DELETED' ? 'blue' : 'orange'}
              actions={
                <Button onClick={() => handleDelete(log.id)} variant="warning" size="sm">
                  <Trash2 className={chrome.buttonIcon} /> Remove
                </Button>
              }
            >
              <div className={styles.metaRow}>
                <SystemTag tone={log.status === 'DELETED' ? 'neutral' : 'alert'}>{log.status}</SystemTag>
                {log.error_code ? <SystemTag tone="warning">{log.error_code}</SystemTag> : null}
                <p className={chrome.metaPill}>Source | {log.source_service}</p>
                <p className={chrome.metaPill}>Routing key | {log.routing_key}</p>
                <p className={chrome.metaPill}>Created | {new Date(log.created_at).toLocaleString()}</p>
                {log.correlation_id ? <p className={chrome.metaPill}>Correlation | {log.correlation_id}</p> : null}
              </div>

              <div className={styles.contextBox}>
                <div className={styles.contextHeader}>
                  <AlertTriangle className={styles.contextIcon} />
                  <p className={styles.contextLabel}>Context payload</p>
                </div>
                <pre className={styles.contextText}>{formatContext(log.context_json)}</pre>
              </div>
            </ModuleBlock>
          ))
        )}
      </div>
    </div>
  );
}

export default ErrorLogs;