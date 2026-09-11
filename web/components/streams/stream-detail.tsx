'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  deleteStream,
  getStream,
  listStreamSessions,
  setMonitoring,
  StreamApiError,
  type Session,
  type StreamDetail
} from '../../lib/api/streams';
import { isStale } from '../../lib/presentation';
import { Status } from '../status/status';
import { AlertBanner } from '../ui/alert-banner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardBody, CardHeader } from '../ui/card';
import { LoadingState } from '../ui/loading-state';
import { ActivityIcon, RefreshIcon } from '../shell/icons';
import { StreamForm } from './stream-management';
import { useStreamRealtime } from '../../lib/realtime';

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Unavailable';

const formatNumber = (value: number | null) => (value === null ? 'Unavailable' : value.toLocaleString());

export function StreamDetailView({ streamId }: { streamId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<StreamDetail | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<StreamApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async (initial = false) => {
    initial ? setLoading(true) : setRefreshing(true);
    setError(null);
    try {
      const [streamResponse, sessionResponse] = await Promise.all([
        getStream(streamId),
        listStreamSessions(streamId)
      ]);
       setDetail(streamResponse);
      setSessions(sessionResponse.sessions);
    } catch (cause) {
      setError(
        cause instanceof StreamApiError
          ? cause
          : new StreamApiError({ code: 'INTERNAL_ERROR', message: 'Unable to load stream.', requestId: '' })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useStreamRealtime(streamId, () => void refresh());

  useEffect(() => {
    void refresh(true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 120_000);
    return () => window.clearInterval(interval);
  }, [streamId]);

  const action = async (callback: () => Promise<unknown>, message: string) => {
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      await callback();
      await refresh();
      setNotice(message);
    } catch (cause) {
      setError(
        cause instanceof StreamApiError
          ? cause
          : new StreamApiError({ code: 'INTERNAL_ERROR', message: 'Request failed.', requestId: '' })
      );
    } finally {
      setRefreshing(false);
    }
  };

  const remove = async () => {
    if (!detail || !window.confirm(`Delete ${detail.stream.name}? Historical sessions, events, and alerts are retained.`))
      return;
    await action(() => deleteStream(detail.stream.id), 'Stream deleted.');
    router.replace('/streams');
  };

  if (loading) return <LoadingState message="Loading channel telemetry..." />;

  if (error && !detail)
    return (
      <section className="space-y-6">
        <Link href="/streams" className="text-sm font-bold text-blue-400 hover:underline">
          Back to directory
        </Link>
        <AlertBanner
          variant="error"
          message={error.code === 'RESOURCE_NOT_FOUND' ? 'Stream not found.' : 'Unable to load stream.'}
          requestId={error.requestId}
          retry={() => void refresh()}
        />
      </section>
    );

  if (!detail) return null;

  const stream = detail.stream;
  const stale = isStale(detail.latestSnapshot?.checkedAt ?? stream.lastSuccessfulAt);
  const comments = detail.recentComments ?? [];
  const likes = detail.recentLikes ?? [];
  const gifts = detail.recentGifts ?? [];

  return (
    <section aria-labelledby="stream-detail-heading" className="space-y-6">
      {/* Back link & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/streams" className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1">
          Back to directory
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/events?streamId=${stream.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/40 px-3.5 py-2 text-sm font-semibold text-indigo-700 shadow-2xs transition-colors hover:bg-indigo-100 active:bg-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
          >
            <ActivityIcon className="h-4 w-4 text-blue-400" />
            View event logs
          </Link>
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshIcon className={`h-4 w-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {notice && <AlertBanner variant="success" message={notice} />}
      {error && (
        <AlertBanner variant="error" message="Unable to complete request." requestId={error.requestId} />
      )}

      {/* Stream Header Card */}
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">TIKTOK LIVE CHANNEL</p>
              <h1 id="stream-detail-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-100">
                {stream.name}
              </h1>
              <p className="mt-1 text-xs font-mono text-slate-400">@{stream.identifier}</p>
              <div className="mt-3 flex items-center gap-2">
                <Status value={stream.status} />
                <Badge variant={stale ? 'amber' : 'emerald'}>
                  {stale ? 'Telemetry Stale' : 'Telemetry Fresh'}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(!editing)}>
                {editing ? 'Close editor' : 'Edit stream'}
              </Button>
              <Button
                variant={stream.monitoringEnabled ? 'secondary' : 'primary'}
                size="sm"
                onClick={() =>
                  void action(
                    () => setMonitoring(stream.id, !stream.monitoringEnabled),
                    stream.monitoringEnabled ? 'Monitoring disabled.' : 'Monitoring enabled.'
                  )
                }
                disabled={refreshing}
              >
                {stream.monitoringEnabled ? 'Disable monitoring' : 'Enable monitoring'}
              </Button>
              <Button variant="danger" size="sm" onClick={() => void remove()} disabled={refreshing}>
                Delete
              </Button>
            </div>
          </div>

          {editing && (
            <div className="mt-6 border-t border-[#1e293b] pt-6">
              <StreamForm
                stream={stream}
                onClose={() => setEditing(false)}
                onSaved={async (message) => {
                  setEditing(false);
                  await refresh();
                  setNotice(message);
                }}
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Grid Telemetry Panels */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card aria-labelledby="monitoring-status-heading">
          <CardHeader title="Monitoring State" id="monitoring-status-heading" />
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2 text-xs font-mono">
              <Metric label="MONITORING" value={stream.monitoringEnabled ? 'ENABLED' : 'DISABLED'} />
              <Metric label="LAST CHECK" value={formatDate(stream.lastCheckedAt)} />
              <Metric label="LAST SUCCESS" value={formatDate(stream.lastSuccessfulAt)} />
              <Metric label="LATEST SNAPSHOT" value={formatDate(detail.latestSnapshot?.checkedAt ?? null)} />
            </dl>
          </CardBody>
        </Card>

        <Card aria-labelledby="latest-audience-heading">
          <CardHeader title="Audience Snapshot" id="latest-audience-heading" />
          <CardBody>
            {detail.latestSnapshot ? (
              <dl className="grid grid-cols-2 gap-4 text-xs font-mono">
                <Metric label="CURRENT VIEWERS" value={formatNumber(detail.latestSnapshot.currentViewers)} />
                <Metric
                  label="COLLECTION STATE"
                  value={detail.latestSnapshot.collectionSucceeded ? 'SUCCESSFUL' : 'FAILED'}
                />
              </dl>
            ) : (
              <p className="text-sm font-medium text-slate-400">No audience metrics recorded yet.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <RecentComments comments={comments} />
        <RecentLikes likes={likes} />
        <RecentGifts gifts={gifts} />
      </div>

      <Card aria-labelledby="active-session-heading">
        <CardHeader title="Active Session Telemetry" id="active-session-heading" />
        <CardBody>
          {detail.activeSession ? (
            <dl className="grid gap-4 sm:grid-cols-3 text-xs font-mono">
              <Metric label="STARTED AT" value={formatDate(detail.activeSession.startedAt)} />
              <Metric label="PEAK VIEWERS" value={formatNumber(detail.activeSession.peakViewers)} />
              <Metric label="TOTAL COMMENTS" value={formatNumber(detail.activeSession.totalComments)} />
            </dl>
          ) : (
            <p className="text-sm font-medium text-slate-400">No active session at this time.</p>
          )}
        </CardBody>
      </Card>

      <Card aria-labelledby="active-alerts-heading">
        <CardHeader
          title="Active Alerts"
          id="active-alerts-heading"
          action={
            <Link href={`/events?streamId=${stream.id}`} className="text-xs font-mono font-bold text-blue-400 hover:underline">
              View full event logs &rarr;
            </Link>
          }
        />
        {detail.activeAlerts.length ? (
          <div className="divide-y divide-[#1e293b]">
            {detail.activeAlerts.map((alert) => (
              <article key={alert.id} className="p-4 hover:bg-[#182035] transition-colors">
                <div className="flex items-center gap-2">
                  <Badge variant={alert.severity === 'CRITICAL' ? 'red' : 'amber'}>{alert.severity}</Badge>
                  <span className="text-xs font-mono font-semibold text-slate-300">{alert.type}</span>
                </div>
                <p className="mt-2 text-sm text-slate-200">{alert.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <CardBody>
            <p className="text-sm font-medium text-slate-400">No active alerts for this stream.</p>
          </CardBody>
        )}
      </Card>

      <Card aria-labelledby="session-history-heading">
        <CardHeader title="Session History" id="session-history-heading" />
        {sessions.length ? (
          <div className="divide-y divide-[#1e293b]">
            {sessions.map((session) => (
              <article key={session.id} className="grid gap-3 p-4 sm:grid-cols-4 hover:bg-[#182035] transition-colors text-xs font-mono">
                <Metric label="STARTED" value={formatDate(session.startedAt)} />
                <Metric label="ENDED" value={formatDate(session.endedAt)} />
                <Metric label="PEAK VIEWERS" value={formatNumber(session.peakViewers)} />
                <Metric label="FINAL STATUS" value={session.finalStatus ?? 'UNAVAILABLE'} />
              </article>
            ))}
          </div>
        ) : (
          <CardBody>
            <p className="text-sm font-medium text-slate-400">No session history available.</p>
          </CardBody>
        )}
      </Card>

    </section>
  );
}

function RecentLikes({ likes }: { likes: StreamDetail['recentLikes'] }) {
  return (
    <Card aria-labelledby="recent-likes-heading">
      <CardHeader title="Recent Likes" subtitle="Viewers who sent likes." action={<span className="text-xs font-mono text-slate-500">{likes.length} stored</span>} />
      {likes.length ? <div className="divide-y divide-[#1e293b]">{likes.slice(0, 15).map((like, index) => <article key={`${like.occurredAt}-${index}`} className="flex items-center justify-between gap-3 p-4"><p className="min-w-0 truncate text-sm font-semibold text-slate-200">{like.displayName || 'TikTok user'}{like.username && like.username !== like.displayName ? <span className="ml-1.5 font-normal font-mono text-slate-400">@{like.username}</span> : null}</p><span className="shrink-0 text-sm font-mono font-bold text-indigo-600">+{like.count.toLocaleString()}</span></article>)}</div> : <CardBody><p className="text-sm font-medium text-slate-400">No like observations recorded.</p></CardBody>}
    </Card>
  );
}

function RecentGifts({ gifts }: { gifts: StreamDetail['recentGifts'] }) {
  return (
    <Card aria-labelledby="recent-gifts-heading">
      <CardHeader title="Recent Gifts" subtitle="Completed gift streaks." action={<span className="text-xs font-mono text-slate-500">{gifts.length} stored</span>} />
      {gifts.length ? <div className="divide-y divide-[#1e293b]">{gifts.slice(0, 15).map((gift, index) => <article key={`${gift.occurredAt}-${gift.giftId}-${index}`} className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">{gift.giftImageUrl ? <img src={gift.giftImageUrl} alt="" className="h-8 w-8 object-contain" loading="lazy" /> : <span className="text-lg" aria-hidden="true">*</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-200">{gift.displayName || 'TikTok user'}{gift.username && gift.username !== gift.displayName ? <span className="ml-1.5 font-normal font-mono text-slate-400">@{gift.username}</span> : null}</p><p className="truncate text-xs text-slate-400">{gift.giftName || `Gift #${gift.giftId}`} x{gift.repeatCount}</p></div></article>)}</div> : <CardBody><p className="text-sm font-medium text-slate-400">No gift observations recorded.</p></CardBody>}
    </Card>
  );
}

function RecentComments({ comments }: { comments: StreamDetail['recentComments'] }) {
  return (
    <Card aria-labelledby="recent-comments-heading">
      <CardHeader
        title="Recent Audience Chat"
        subtitle="Live chat observation feed."
        action={
          <span className="text-xs font-mono text-slate-500">{comments.length} stored</span>
        }
      />
      {comments.length ? (
        <div className="divide-y divide-[#1e293b]">
          {comments.slice(0, 15).map((comment, index) => (
            <article key={`${comment.occurredAt}-${index}`} className="p-4 hover:bg-[#182035] transition-colors">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-slate-200">
                  {comment.displayName || 'TikTok user'}
                  {comment.username && comment.username !== comment.displayName ? (
                    <span className="ml-1.5 font-normal font-mono text-slate-400">@{comment.username}</span>
                  ) : null}
                </p>
                <time className="shrink-0 text-[11px] font-mono text-slate-500" dateTime={comment.occurredAt}>
                  {formatDate(comment.occurredAt)}
                </time>
              </div>
              <p className="mt-1 text-sm text-slate-300 break-words">{comment.text}</p>
            </article>
          ))}
        </div>
      ) : (
        <CardBody>
          <p className="text-sm font-medium text-slate-400">No chat observations recorded for this channel.</p>
        </CardBody>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-mono uppercase text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-mono font-semibold tabular-nums text-slate-100">{value}</dd>
    </div>
  );
}
