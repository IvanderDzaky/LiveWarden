'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  createStream,
  deleteStream,
  listStreams,
  setMonitoring,
  StreamApiError,
  type Stream,
  type StreamStatus,
  updateStream
} from '../../lib/api/streams';
import { Status } from '../status/status';
import { AlertBanner } from '../ui/alert-banner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardBody, CardHeader } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { ActivityIcon, AlertIcon, EyeIcon, PlusIcon, RefreshIcon, SearchIcon, ShieldIcon, StreamIcon } from '../shell/icons';
import { realtimeUserUrl, useRealtime } from '../../lib/realtime';

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Never';

const safeMessage = (error: StreamApiError, fallback: string) =>
  ['VALIDATION_ERROR', 'CONFLICT'].includes(error.code) ? error.message : fallback;

export function StreamManagement() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<StreamApiError | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Stream | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StreamStatus | 'ALL'>('ALL');

  const refresh = async (initial = false) => {
    initial ? setLoading(true) : setRefreshing(true);
    setError(null);
    try {
      setStreams((await listStreams()).streams);
    } catch (cause) {
      setError(
        cause instanceof StreamApiError
          ? cause
          : new StreamApiError({
              code: 'INTERNAL_ERROR',
              message: 'Unable to load streams.',
              requestId: ''
            })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useRealtime(realtimeUserUrl, () => void refresh());

  useEffect(() => {
    void refresh(true);
  }, []);

  const mutate = async (id: string, action: () => Promise<unknown>, success: string) => {
    if (workingId) return;
    setWorkingId(id);
    setNotice(null);
    setError(null);
    try {
      await action();
      await refresh();
      setNotice(success);
    } catch (cause) {
      setError(
        cause instanceof StreamApiError
          ? cause
          : new StreamApiError({
              code: 'INTERNAL_ERROR',
              message: 'Request failed.',
              requestId: ''
            })
      );
    } finally {
      setWorkingId(null);
    }
  };

  const remove = async (stream: Stream) => {
    if (
      !window.confirm(
        `Delete ${stream.name}? Active stream configuration will be removed. Historical sessions, events, and alerts are retained.`
      )
    )
      return;
    await mutate(stream.id, () => deleteStream(stream.id), 'Stream deleted. History retained.');
  };

  if (loading) return <LoadingState message="Loading stream telemetry directory..." />;

  // Filter calculations
  const filteredStreams = streams.filter((stream) => {
    const matchesSearch =
      !search.trim() ||
      stream.name.toLowerCase().includes(search.toLowerCase()) ||
      stream.identifier.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || stream.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const countByStatus = {
    ALL: streams.length,
    LIVE: streams.filter((s) => s.status === 'LIVE').length,
    DEGRADED: streams.filter((s) => s.status === 'DEGRADED').length,
    OFFLINE: streams.filter((s) => s.status === 'OFFLINE').length,
    UNKNOWN: streams.filter((s) => s.status === 'UNKNOWN').length,
    DISCONNECTED: streams.filter((s) => s.status === 'DISCONNECTED').length
  };

  const liveCount = countByStatus.LIVE;
  const problemCount = countByStatus.DEGRADED + countByStatus.UNKNOWN + countByStatus.DISCONNECTED;

  return (
    <div className="space-y-6">
      {/* Stitch Top KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="TOTAL MONITORED"
          value={streams.length}
          icon={<StreamIcon className="h-4 w-4 text-blue-400" />}
          accentBorder="border-t-2 border-t-blue-500"
        />
        <KpiCard
          title="LIVE CHANNELS"
          value={liveCount}
          icon={<EyeIcon className="h-4 w-4 text-emerald-400" />}
          accentBorder="border-t-2 border-t-emerald-500"
        />
        <KpiCard
          title="PROBLEM CHANNELS"
          value={problemCount}
          icon={<ShieldIcon className="h-4 w-4 text-amber-400" />}
          accentBorder={problemCount > 0 ? 'border-t-2 border-t-amber-500' : 'border-t-2 border-t-slate-700'}
        />
        <KpiCard
          title="POLLING WORKER"
          value={streams.filter((s) => s.monitoringEnabled).length}
          icon={<ActivityIcon className="h-4 w-4 text-sky-400" />}
          accentBorder="border-t-2 border-t-sky-500"
        />
      </div>

      {/* Stream Directory Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[#1e293b] pb-5">
        <div>
          <h2 id="streams-heading" className="text-2xl font-bold tracking-tight text-slate-100">
            Stream Directory
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Manage, observe, and inspect real-time telemetry from monitored TikTok LIVE channels.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refresh()}
            disabled={refreshing || Boolean(workingId)}
          >
            <RefreshIcon className={`h-4 w-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={Boolean(workingId)}
          >
            <PlusIcon className="h-4 w-4" />
            Add stream
          </Button>
        </div>
      </div>

      {/* Notice & Error Banners */}
      {notice && <AlertBanner variant="success" message={notice} />}
      {error && (
        <AlertBanner
          variant="error"
          message={safeMessage(error, 'Unable to complete stream request.')}
          requestId={error.requestId}
          retry={() => void refresh()}
        />
      )}

      {/* Stream Form Drawer/Modal */}
      {formOpen && (
        <StreamForm
          stream={editing}
          onClose={() => setFormOpen(false)}
          onSaved={async (message) => {
            setFormOpen(false);
            await refresh();
            setNotice(message);
          }}
        />
      )}

      {/* Monitoring status */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1e293b] bg-[#141a2b] px-4 py-2.5 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="inline-flex h-2 w-2 rounded-full bg-sky-500" />
          <span className="font-bold text-slate-100">MONITORING CONFIGURED</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Worker checks enabled channels</span>
        </div>
        <div className="flex gap-4 text-slate-400">
          <span>Configured: <span className="font-bold text-slate-200">{streams.length}</span></span>
          <span>Monitored: <span className="font-bold text-slate-200">{streams.filter((stream) => stream.monitoringEnabled).length}</span></span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <Card>
        <CardBody className="p-4 space-y-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <SearchIcon className="h-4 w-4" />
            </div>
            <input
              type="search"
              placeholder="Search streams by name or @username handle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-[#24304c] bg-[#0b0f19] pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Stitch-style Compact Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#1e293b]">
            <FilterChip
              label="All"
              count={countByStatus.ALL}
              active={statusFilter === 'ALL'}
              onClick={() => setStatusFilter('ALL')}
            />
            <FilterChip
              label="Live"
              count={countByStatus.LIVE}
              active={statusFilter === 'LIVE'}
              variant="emerald"
              onClick={() => setStatusFilter('LIVE')}
            />
            <FilterChip
              label="Degraded"
              count={countByStatus.DEGRADED}
              active={statusFilter === 'DEGRADED'}
              variant="amber"
              onClick={() => setStatusFilter('DEGRADED')}
            />
            <FilterChip
              label="Offline"
              count={countByStatus.OFFLINE}
              active={statusFilter === 'OFFLINE'}
              onClick={() => setStatusFilter('OFFLINE')}
            />
            <FilterChip
              label="Unknown"
              count={countByStatus.UNKNOWN}
              active={statusFilter === 'UNKNOWN'}
              onClick={() => setStatusFilter('UNKNOWN')}
            />
          </div>
        </CardBody>
      </Card>

      {/* Stream List / Cards */}
      {filteredStreams.length === 0 ? (
        <EmptyState
          icon={<StreamIcon className="h-6 w-6 text-blue-400" />}
          title="No matching streams"
          description={
            streams.length === 0
              ? 'Add a TikTok LIVE channel to start monitoring.'
              : 'No channels match your active search or filter criteria.'
          }
          action={
            streams.length === 0 ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <PlusIcon className="h-4 w-4" />
                Add your first stream
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('ALL'); }}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredStreams.map((stream) => (
            <StreamItemCard
              key={stream.id}
              stream={stream}
              working={workingId === stream.id}
              onToggle={() =>
                void mutate(
                  stream.id,
                  () => setMonitoring(stream.id, !stream.monitoringEnabled),
                  stream.monitoringEnabled ? 'Monitoring disabled.' : 'Monitoring enabled.'
                )
              }
              onEdit={() => {
                setEditing(stream);
                setFormOpen(true);
              }}
              onDelete={() => void remove(stream)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  accentBorder
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  accentBorder: string;
}) {
  return (
    <div className={`rounded-lg border border-[#1e293b] bg-[#141a2b] p-4 shadow-2xs ${accentBorder}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono font-bold tracking-wider text-slate-400">{title}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#26324e] bg-[#1c253e]">
          {icon}
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight text-slate-100">{value}</p>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  variant = 'neutral',
  onClick
}: {
  label: string;
  count: number;
  active: boolean;
  variant?: 'neutral' | 'emerald' | 'amber';
  onClick: () => void;
}) {
  const activeStyles = {
    neutral: 'bg-blue-600 text-white border-blue-600 font-bold',
    emerald: 'bg-emerald-600 text-white border-emerald-600 font-bold',
    amber: 'bg-amber-600 text-white border-amber-600 font-bold'
  };

  const inactiveStyles = 'bg-[#182035] text-slate-400 border-[#24304c] hover:bg-[#1f2a46] hover:text-slate-200';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-mono transition-colors ${
        active ? activeStyles[variant] : inactiveStyles
      }`}
    >
      <span>{label}</span>
      <span className="rounded bg-black/30 px-1.5 py-0.2 text-[10px] font-bold">{count}</span>
    </button>
  );
}

function StreamItemCard({
  stream,
  working,
  onToggle,
  onEdit,
  onDelete
}: {
  stream: Stream;
  working: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="hover:border-[#2a3854] transition-colors">
      <CardBody className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/streams/${stream.id}`}
                  className="text-base font-bold text-slate-100 hover:text-blue-400 hover:underline"
                >
                  {stream.name}
                </Link>
                <Badge variant="blue">{stream.platform}</Badge>
              </div>
              <p className="mt-0.5 text-xs font-mono text-slate-400">@{stream.identifier}</p>
            </div>
          </div>
          <Status value={stream.status} />
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 gap-4 border-y border-[#1e293b] py-3 text-xs font-mono sm:grid-cols-4">
          <div>
            <span className="text-[10px] uppercase text-slate-500 block">MONITORING</span>
            <span className="mt-1 font-bold text-slate-200 block">
              {stream.monitoringEnabled ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-500 block">LAST TELEMETRY</span>
            <span className="mt-1 text-slate-300 block">{formatDate(stream.lastCheckedAt)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-500 block">LAST SUCCESS</span>
            <span className="mt-1 text-slate-300 block">{formatDate(stream.lastSuccessfulAt)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-500 block">ROOM ID</span>
            <span className="mt-1 text-slate-400 block truncate" title={stream.lastRoomId ?? 'None'}>
              {stream.lastRoomId ?? 'Unavailable'}
            </span>
          </div>
        </div>

        {/* Stream Actions row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/streams/${stream.id}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50/40 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs transition-colors hover:bg-indigo-100 active:bg-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
            >
              View detail
            </Link>
            <Link
              href={`/events?streamId=${stream.id}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50/40 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs transition-colors hover:bg-indigo-100 active:bg-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
            >
              <ActivityIcon className="h-3.5 w-3.5 text-blue-400" />
              Logs
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onToggle} disabled={working}>
              {stream.monitoringEnabled ? 'Disable' : 'Enable'}
            </Button>
            <Button variant="secondary" size="sm" onClick={onEdit} disabled={working}>
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete} disabled={working}>
              Delete
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function StreamForm({
  stream,
  onClose,
  onSaved
}: {
  stream: Stream | null;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState(stream?.name ?? '');
  const [identifier, setIdentifier] = useState(stream?.identifier ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<StreamApiError | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const trimmedName = name.trim();
    const normalizedIdentifier = identifier.trim().replace(/^@+/, '');
    if (!trimmedName || !normalizedIdentifier) {
      setError(
        new StreamApiError({
          code: 'VALIDATION_ERROR',
          message: 'Name and TikTok username are required.',
          requestId: ''
        })
      );
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (stream) {
        await updateStream(stream.id, { name: trimmedName, identifier: normalizedIdentifier });
      } else {
        await createStream({
          name: trimmedName,
          platform: 'TIKTOK_LIVE',
          identifier: normalizedIdentifier
        });
      }
      await onSaved(stream ? 'Stream updated.' : 'Stream created disabled with status UNKNOWN.');
    } catch (cause) {
      setError(
        cause instanceof StreamApiError
          ? cause
          : new StreamApiError({ code: 'INTERNAL_ERROR', message: 'Request failed.', requestId: '' })
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-blue-900/80">
      <CardHeader
        title={stream ? 'Edit Stream' : 'Add Stream'}
        subtitle="TikTok LIVE channel. Provider validation occurs during active monitoring."
        action={
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="stream-name" className="mb-1.5 block text-xs font-mono font-bold text-slate-300">
              CHANNEL NAME
            </label>
            <input
              id="stream-name"
              required
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={submitting}
              className="w-full rounded-md border border-[#24304c] bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-[#141a2b]"
            />
          </div>

          <div>
            <label htmlFor="stream-identifier" className="mb-1.5 block text-xs font-mono font-bold text-slate-300">
              TIKTOK USERNAME
            </label>
            <input
              id="stream-identifier"
              required
              maxLength={101}
              placeholder="@creator"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              disabled={submitting}
              className="w-full rounded-md border border-[#24304c] bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-[#141a2b]"
            />
          </div>

          {error && (
            <div className="sm:col-span-2">
              <AlertBanner
                variant="error"
                message={safeMessage(error, 'Unable to save stream.')}
                requestId={error.requestId}
              />
            </div>
          )}

          <div className="flex gap-2 sm:col-span-2 pt-2">
            <Button variant="primary" size="md" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : stream ? 'Save changes' : 'Create stream'}
            </Button>
            <Button variant="secondary" size="md" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
