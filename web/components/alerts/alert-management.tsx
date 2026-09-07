'use client';

import { useEffect, useRef, useState } from 'react';
import {
  acknowledgeAlert,
  AlertApiError,
  getAlert,
  listAlerts,
  type Alert,
  type AlertSeverity,
  type AlertStatus
} from '../../lib/api/alerts';
import { AlertBanner } from '../ui/alert-banner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardBody } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { AlertIcon, CloseIcon, RefreshIcon } from '../shell/icons';

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Unavailable';

const severityRank: Record<AlertSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
const statusLabel: Record<AlertStatus, string> = { ACTIVE: 'Active', ACKNOWLEDGED: 'Acknowledged', RESOLVED: 'Resolved' };

export function AlertManagement() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [severity, setSeverity] = useState<AlertSeverity | ''>('');
  const [status, setStatus] = useState<AlertStatus | ''>('');
  const [selected, setSelected] = useState<Alert | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<AlertApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async (initial = false) => {
    initial ? setLoading(true) : setRefreshing(true);
    setError(null);
    try {
      const result = await listAlerts({
        severity: severity || undefined,
        status: status || undefined
      });
      setAlerts(
        result.alerts.sort(
          (a, b) =>
            severityRank[a.severity] - severityRank[b.severity] ||
            Date.parse(b.lastDetectedAt) - Date.parse(a.lastDetectedAt)
        )
      );
    } catch (cause) {
      setError(
        cause instanceof AlertApiError
          ? cause
          : new AlertApiError({ code: 'INTERNAL_ERROR', message: 'Unable to load alerts.', requestId: '' })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh(true);
  }, [severity, status]);

  const openDetail = async (alert: Alert) => {
    setSelected(alert);
    setNote('');
    try {
      setSelected((await getAlert(alert.id)).alert);
    } catch (cause) {
      setError(
        cause instanceof AlertApiError
          ? cause
          : new AlertApiError({ code: 'INTERNAL_ERROR', message: 'Unable to load alert.', requestId: '' })
      );
    }
  };

  const acknowledge = async () => {
    if (!selected) return;
    setWorking(true);
    setError(null);
    try {
      await acknowledgeAlert(selected.id, note.trim() || undefined);
      setSelected(null);
      setNotice('Alert acknowledged. Technical stream status was not changed.');
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof AlertApiError
          ? cause
          : new AlertApiError({ code: 'INTERNAL_ERROR', message: 'Unable to acknowledge alert.', requestId: '' })
      );
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <LoadingState message="Loading alert queue..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="alerts-heading" className="text-2xl font-bold tracking-tight text-slate-100">
            Alert Queue
          </h2>
          <p className="mt-1 text-sm text-slate-400">Actionable monitoring conditions requiring operator attention.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshIcon className={`h-4 w-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3">
              <label htmlFor="severity-filter" className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 shrink-0">
                SEVERITY
              </label>
              <select
                id="severity-filter"
                value={severity}
                onChange={(event) => setSeverity(event.target.value as AlertSeverity | '')}
                className="w-full rounded-md border border-[#24304c] bg-[#0b0f19] px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:max-w-xs"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </div>

            <div className="flex flex-1 items-center gap-3">
              <label htmlFor="status-filter" className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 shrink-0">
                LIFECYCLE STATUS
              </label>
              <select
                id="status-filter"
                value={status}
                onChange={(event) => setStatus(event.target.value as AlertStatus | '')}
                className="w-full rounded-md border border-[#24304c] bg-[#0b0f19] px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:max-w-xs"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Banners */}
      {notice && <AlertBanner variant="success" message={notice} />}
      {error && (
        <AlertBanner
          variant="error"
          message="Unable to complete alert request."
          requestId={error.requestId}
          retry={() => void refresh()}
        />
      )}

      {/* Alert List */}
      {alerts.length === 0 ? (
        <EmptyState
          icon={<AlertIcon className="h-6 w-6 text-blue-400" />}
          title="No alerts in queue"
          description="There are no active or matching alerts for the selected criteria."
        />
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onOpen={() => void openDetail(alert)} />
          ))}
        </div>
      )}

      {/* Alert Detail Modal */}
      {selected && (
        <AlertDetail
          alert={selected}
          note={note}
          setNote={setNote}
          working={working}
          onClose={() => setSelected(null)}
          onAcknowledge={() => void acknowledge()}
        />
      )}
    </div>
  );
}

function AlertCard({ alert, onOpen }: { alert: Alert; onOpen: () => void }) {
  const getLifecycleVariant = (st: AlertStatus) => {
    if (st === 'ACTIVE') return 'emerald';
    if (st === 'ACKNOWLEDGED') return 'blue';
    return 'zinc';
  };

  return (
    <Card
      className={`transition-colors ${
        alert.severity === 'CRITICAL'
          ? 'border-l-4 border-l-rose-500 border-[#1e293b]'
          : alert.severity === 'WARNING'
          ? 'border-l-4 border-l-amber-500 border-[#1e293b]'
          : 'border-[#1e293b]'
      }`}
    >
      <CardBody className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant={alert.severity === 'CRITICAL' ? 'red' : alert.severity === 'WARNING' ? 'amber' : 'blue'}>
                {alert.severity}
              </Badge>
              <Badge variant={getLifecycleVariant(alert.status)}>
                {statusLabel[alert.status]}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-mono text-slate-400">Stream ID: {alert.streamId}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={onOpen}>
            View details
          </Button>
        </div>

        <p className="mt-3 text-sm font-bold text-slate-100">{alert.description}</p>

        {alert.recommendedAction && (
          <p className="mt-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Action:</span> {alert.recommendedAction}
          </p>
        )}

        <dl className="mt-4 grid gap-3 text-xs font-mono sm:grid-cols-3 border-t border-[#1e293b] pt-3">
          <div>
            <dt className="text-slate-500">First detected</dt>
            <dd className="mt-0.5 font-medium text-slate-300">{formatDate(alert.firstDetectedAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Last detected</dt>
            <dd className="mt-0.5 font-medium text-slate-300">{formatDate(alert.lastDetectedAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Resolved</dt>
            <dd className="mt-0.5 font-medium text-slate-300">{formatDate(alert.resolvedAt)}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}

function AlertDetail({
  alert,
  note,
  setNote,
  working,
  onClose,
  onAcknowledge
}: {
  alert: Alert;
  note: string;
  setNote: (value: string) => void;
  working: boolean;
  onClose: () => void;
  onAcknowledge: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-detail-heading"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-lg bg-[#141a2b] p-6 shadow-2xl sm:rounded-lg border border-[#1e293b]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant={alert.severity === 'CRITICAL' ? 'red' : alert.severity === 'WARNING' ? 'amber' : 'blue'}>
                {alert.severity}
              </Badge>
              <Badge variant={alert.status === 'ACTIVE' ? 'emerald' : alert.status === 'ACKNOWLEDGED' ? 'blue' : 'zinc'}>
                {statusLabel[alert.status]}
              </Badge>
            </div>
            <h2 id="alert-detail-heading" className="mt-2 text-xl font-bold text-slate-100">
              {alert.type}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-slate-400 hover:bg-[#1a2238] hover:text-slate-200"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-6 grid gap-4 text-xs font-mono sm:grid-cols-2 border-y border-[#1e293b] py-4">
          <div>
            <dt className="text-slate-500">Stream ID</dt>
            <dd className="mt-1 break-all font-semibold text-slate-200">{alert.streamId}</dd>
          </div>
          <div>
            <dt className="text-slate-500">First Detected</dt>
            <dd className="mt-1 font-semibold text-slate-200">{formatDate(alert.firstDetectedAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Last Detected</dt>
            <dd className="mt-1 font-semibold text-slate-200">{formatDate(alert.lastDetectedAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Resolved</dt>
            <dd className="mt-1 font-semibold text-slate-200">{formatDate(alert.resolvedAt)}</dd>
          </div>
        </dl>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-slate-100">{alert.description}</p>
          {alert.recommendedAction && (
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Recommended Action:</span> {alert.recommendedAction}
            </p>
          )}
        </div>

        {/* Acknowledgement history */}
        {alert.acknowledgements && alert.acknowledgements.length > 0 && (
          <div className="mt-6 border-t border-[#1e293b] pt-4">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Acknowledgement History</h3>
            <div className="mt-2 divide-y divide-[#1e293b]">
              {alert.acknowledgements.map((ack) => (
                <div key={ack.id} className="py-2 text-xs font-mono">
                  <p className="font-semibold text-slate-300">Acknowledged at {formatDate(ack.acknowledgedAt)}</p>
                  {ack.note && <p className="mt-0.5 text-slate-400">Note: {ack.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action form if ACTIVE */}
        {alert.status === 'ACTIVE' && (
          <div className="mt-6 border-t border-[#1e293b] pt-4 space-y-3">
            <label htmlFor="ack-note" className="block text-xs font-mono font-bold text-slate-300">
              OPERATOR NOTE (OPTIONAL)
            </label>
            <textarea
              id="ack-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add operator investigation context..."
              disabled={working}
              className="w-full rounded-md border border-[#24304c] bg-[#0b0f19] p-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-[#141a2b]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="md" onClick={onClose} disabled={working}>
                Close
              </Button>
              <Button variant="primary" size="md" onClick={onAcknowledge} disabled={working}>
                {working ? 'Acknowledging...' : 'Acknowledge alert'}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
