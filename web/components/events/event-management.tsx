'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EventApiError, listEvents, type EventLogItem } from '../../lib/api/events';
import { listStreams, type Stream } from '../../lib/api/streams';
import { AlertBanner } from '../ui/alert-banner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardBody } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { ActivityIcon, RefreshIcon } from '../shell/icons';

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium'
      }).format(new Date(value))
    : 'Unavailable';

export function EventManagement() {
  const searchParams = useSearchParams();
  const initialStreamId = searchParams.get('streamId') ?? '';

  const [events, setEvents] = useState<EventLogItem[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamId, setStreamId] = useState(initialStreamId);
  const [eventType, setEventType] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<EventApiError | null>(null);

  const loadStreams = async () => {
    try {
      const res = await listStreams();
      setStreams(res.streams);
    } catch {
      // Non-critical if stream list fails to load for filter dropdown
    }
  };

  const refresh = async (initial = false) => {
    initial ? setLoading(true) : setRefreshing(true);
    setError(null);
    try {
      const res = await listEvents({
        streamId: streamId || undefined,
        type: eventType || undefined,
        limit
      });
      setEvents(res.events);
    } catch (cause) {
      setError(
        cause instanceof EventApiError
          ? cause
          : new EventApiError({ code: 'INTERNAL_ERROR', message: 'Unable to load event logs.', requestId: '' })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadStreams();
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [streamId, eventType, limit]);

  const filteredEvents = events.filter((evt) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      evt.type.toLowerCase().includes(term) ||
      evt.streamId.toLowerCase().includes(term) ||
      (evt.streamName && evt.streamName.toLowerCase().includes(term))
    );
  });

  if (loading) return <LoadingState message="Loading telemetry event logs..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="events-heading" className="text-2xl font-bold tracking-tight text-slate-100">
            Telemetry Event Logs
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Chronological operational and system event records across monitored channels.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshIcon className={`h-4 w-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Filters Toolbar */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Stream Filter */}
            <div className="flex flex-1 items-center gap-2">
              <label htmlFor="stream-filter" className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 shrink-0">
                STREAM
              </label>
              <select
                id="stream-filter"
                value={streamId}
                onChange={(e) => setStreamId(e.target.value)}
                className="w-full rounded-md border border-[#24304c] bg-[#0b0f19] px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Streams</option>
                {streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (@{s.identifier})
                  </option>
                ))}
              </select>
            </div>

            {/* Event Type Filter */}
            <div className="flex flex-1 items-center gap-2">
              <label htmlFor="type-filter" className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 shrink-0">
                TYPE
              </label>
              <input
                id="type-filter"
                placeholder="e.g. COMMENT, LIKE, STREAM_STARTED"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-md border border-[#24304c] bg-[#0b0f19] px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Quick Search */}
            <div className="flex flex-1 items-center gap-2">
              <label htmlFor="search-filter" className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 shrink-0">
                SEARCH
              </label>
              <input
                id="search-filter"
                placeholder="Filter logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-[#24304c] bg-[#0b0f19] px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Limit Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="limit-filter" className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                LIMIT
              </label>
              <select
                id="limit-filter"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-md border border-[#24304c] bg-[#0b0f19] px-2.5 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Banners */}
      {error && (
        <AlertBanner
          variant="error"
          message="Unable to load event logs."
          requestId={error.requestId}
          retry={() => void refresh()}
        />
      )}

      {/* Events Table / Operational Log View */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon className="h-6 w-6 text-blue-400" />}
          title="No event logs found"
          description="No event records match the selected stream or filter criteria."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-[#1e293b] bg-[#0e1322] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Timestamp
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Event Type
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Stream
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Source
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Payload
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b] bg-[#141a2b]">
                {filteredEvents.map((evt) => (
                  <EventRow key={evt.eventId} event={evt} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function EventRow({ event }: { event: EventLogItem }) {
  const getBadgeVariant = (type: string) => {
    if (type.startsWith('STREAM_STARTED')) return 'emerald';
    if (type.startsWith('STREAM_STOPPED')) return 'blue';
    if (type.includes('SPIKE') || type.includes('CHANGE')) return 'amber';
    if (type.includes('ALERT') || type.includes('ERROR')) return 'red';
    return 'zinc';
  };

  const payloadSummary = event.payload ? JSON.stringify(event.payload) : '';

  return (
    <tr className="hover:bg-[#182035] transition-colors">
      <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-400 tabular-nums">
        {formatDate(event.occurredAt)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <Badge variant={getBadgeVariant(event.type)}>{event.type}</Badge>
      </td>
      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-200">
        <a href={`/streams/${event.streamId}`} className="hover:text-blue-400 hover:underline">
          {event.streamName ?? event.streamId.slice(0, 8)}
        </a>
        {event.streamIdentifier && (
          <span className="ml-1 text-[11px] font-normal text-slate-500">@{event.streamIdentifier}</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-slate-400 text-[11px]">
        {event.source}
      </td>
      <td className="px-4 py-3 max-w-md truncate text-slate-400 text-[11px]" title={payloadSummary}>
        {payloadSummary || '-'}
      </td>
    </tr>
  );
}
