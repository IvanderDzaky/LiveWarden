'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardApiError, getDashboardOverview, type DashboardOverview } from '../../lib/api/dashboard';
import { isStale } from '../../lib/presentation';
import { Status } from '../status/status';
import { AlertBanner } from '../ui/alert-banner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardBody, CardHeader } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { ActivityIcon, AlertIcon, EyeIcon, RefreshIcon, ShieldIcon, StreamIcon } from '../shell/icons';
import { realtimeUserUrl, useRealtime } from '../../lib/realtime';

const formatDate = (value: string | Date | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Never';

const formatDuration = (startedAt: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

const severityRank = { CRITICAL: 0, WARNING: 1, INFO: 2 };

export function DashboardOverview() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<DashboardApiError | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useRealtime(realtimeUserUrl, () => void refresh());

  const refresh = async (initial = false) => {
    initial ? setLoading(true) : setRefreshing(true);
    setError(null);
    try {
      setOverview(await getDashboardOverview());
      setUpdatedAt(new Date());
    } catch (cause) {
      setError(
        cause instanceof DashboardApiError
          ? cause
          : new DashboardApiError({
              code: 'INTERNAL_ERROR',
              message: 'Unable to load dashboard.',
              requestId: ''
            })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh(true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 120_000);
    return () => window.clearInterval(interval);
  }, []);

  if (loading) return <LoadingState message="Loading telemetry overview..." />;

  if (error && !overview)
    return (
      <section className="space-y-6">
        <Heading updatedAt={updatedAt} onRefresh={() => void refresh()} refreshing={refreshing} />
        <AlertBanner
          variant="error"
          message="Unable to load current dashboard data."
          requestId={error.requestId}
          retry={() => void refresh()}
        />
      </section>
    );

  if (!overview) return null;

  const alerts = [...overview.activeAlerts].sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      Date.parse(b.lastDetectedAt) - Date.parse(a.lastDetectedAt)
  );

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-6">
      <Heading updatedAt={updatedAt} onRefresh={() => void refresh()} refreshing={refreshing} />

      {error && (
        <AlertBanner
          variant="error"
          message="Unable to load current dashboard data."
          requestId={error.requestId}
          retry={() => void refresh()}
        />
      )}

      {overview.streams.length === 0 ? (
        <EmptyState
          icon={<StreamIcon className="h-6 w-6 text-blue-400" />}
          title="No streams configured"
          description="Add a TikTok LIVE channel to start monitoring and observing real-time status."
          action={
            <Link
              href="/streams"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-2xs transition-colors hover:bg-indigo-700 active:bg-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
            >
              Manage streams
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Monitored streams"
              value={overview.kpis.monitoredStreams}
              description="Channels with monitoring enabled"
              icon={<StreamIcon className="h-4 w-4 text-blue-400" />}
            />
            <KpiCard
              title="Live streams"
              value={overview.kpis.liveStreams}
              description="Channels currently broadcasting"
              icon={<EyeIcon className="h-4 w-4 text-emerald-400" />}
            />
            <KpiCard
              title="Problem streams"
              value={overview.kpis.problemStreams}
              description="Channels requiring attention"
              icon={<ShieldIcon className="h-4 w-4 text-amber-400" />}
            />
            <KpiCard
              title="Active alerts"
              value={overview.kpis.activeAlerts}
              description="Unresolved monitoring alerts"
              icon={<AlertIcon className="h-4 w-4 text-rose-400" />}
            />
          </div>

          {/* Stream Status Overview Table */}
          <StreamStatusOverview streams={overview.streams} />

          {/* Active Alerts Section */}
          <Card aria-labelledby="alerts-heading">
            <CardHeader
              title="Active Alerts"
              subtitle="Conditions requiring operator investigation."
              action={
                <Link href="/events" className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1">
                  View event logs
                </Link>
              }
            />
            {alerts.length ? (
              <div className="divide-y divide-[#1e293b]">
                {alerts.slice(0, 8).map((alert) => (
                  <article
                    key={alert.id}
                    className={`p-4 transition-colors ${
                      alert.severity === 'CRITICAL'
                        ? 'border-l-4 border-rose-500 bg-rose-950/20'
                        : alert.severity === 'WARNING'
                        ? 'border-l-4 border-amber-500 bg-amber-950/20'
                        : 'hover:bg-[#182035]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            alert.severity === 'CRITICAL'
                              ? 'red'
                              : alert.severity === 'WARNING'
                              ? 'amber'
                              : 'neutral'
                          }
                        >
                          {alert.severity}
                        </Badge>
                        <Badge variant="zinc">{alert.status}</Badge>
                      </div>
                      <time className="text-xs font-mono text-slate-400" dateTime={alert.lastDetectedAt}>
                        {formatDate(alert.lastDetectedAt)}
                      </time>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{alert.description}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">Action:</span>{' '}
                      {alert.recommendedAction ?? 'Review stream telemetry.'}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <CardBody>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-400">No active alerts requiring attention.</p>
                  <Link
                    href="/events"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50/40 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs transition-colors hover:bg-indigo-100 active:bg-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                  >
                    <ActivityIcon className="h-4 w-4 text-blue-400" />
                    View event logs
                  </Link>
                </div>
              </CardBody>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

function KpiCard({
  title,
  value,
  icon,
  description
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-600">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-50 ring-1 ring-inset ring-slate-200">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function StreamStatusOverview({ streams }: { streams: DashboardOverview['streams'] }) {
  return (
    <Card aria-labelledby="stream-status-heading">
      <CardHeader
        title="Stream Directory Overview"
        subtitle="Current status and telemetry of monitored streams."
        action={
          <Link href="/streams" className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1">
            Manage directory
          </Link>
        }
      />
      <div className="divide-y divide-[#1e293b] overflow-x-auto">
        {streams.map((stream) => {
          const stale = isStale(stream.latestSnapshotAt);
          const problem = ['DEGRADED', 'UNKNOWN', 'DISCONNECTED'].includes(stream.status);

          return (
            <article
              key={stream.id}
              className={`grid gap-4 p-4 sm:p-5 transition-colors md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center ${
                problem ? 'bg-amber-950/20 hover:bg-amber-950/40' : 'hover:bg-[#182035]'
              }`}
            >
              <div>
                <Link
                  href={`/streams/${stream.id}`}
                  className="font-bold text-slate-100 hover:text-blue-400 hover:underline"
                >
                  {stream.name}
                </Link>
                <p className="mt-0.5 text-xs font-mono text-slate-400">@{stream.identifier}</p>
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase text-slate-500">Status</p>
                <div className="mt-1">
                  <Status value={stream.status} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase text-slate-500">Viewers</p>
                <p className="mt-1 text-sm font-mono tabular-nums font-semibold text-slate-200">
                  {stream.latestViewers === null ? 'Unavailable' : stream.latestViewers.toLocaleString()}
                </p>
                {stream.activeSession && stream.status === 'LIVE' && (
                  <p className="mt-0.5 text-xs font-mono text-slate-400">
                    Live {formatDuration(stream.activeSession.startedAt)}
                  </p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase text-slate-500">Last Telemetry</p>
                <p className="mt-1 text-xs font-mono text-slate-300">
                  {formatDate(stream.latestSnapshotAt ?? stream.lastCheckedAt)}
                </p>
                <p
                  className={`mt-0.5 text-[11px] font-semibold ${
                    stale ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {stale ? 'Stale observation' : 'Fresh telemetry'}
                </p>
              </div>

              <div className="text-left md:text-right">
                <Badge variant={stream.monitoringEnabled ? 'blue' : 'zinc'}>
                  {stream.monitoringEnabled ? 'Monitoring' : 'Disabled'}
                </Badge>
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

function Heading({
  updatedAt,
  onRefresh,
  refreshing
}: {
  updatedAt: Date | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id="dashboard-heading" className="text-2xl font-bold tracking-tight text-slate-100">
          NOC Overview
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Real-time operational dashboard for monitored livestream channels.
        </p>
      </div>
      <div className="flex items-center gap-3">
        {updatedAt && (
          <p className="text-right text-xs font-mono text-slate-500">
            Updated {formatDate(updatedAt)}
          </p>
        )}
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshIcon className={`h-4 w-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
}
