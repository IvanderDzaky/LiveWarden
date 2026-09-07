import type { StreamStatus } from '../../lib/api/streams';
import { statusLabel } from '../../lib/presentation';
export { statusLabel } from '../../lib/presentation';

export function Status({ value }: { value: StreamStatus }) {
  const tones: Record<
    StreamStatus,
    { dot: string; bg: string; text: string; border: string; pulse?: boolean }
  > = {
    LIVE: {
      dot: 'bg-emerald-400',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      pulse: true
    },
    OFFLINE: {
      dot: 'bg-slate-500',
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-200'
    },
    DEGRADED: {
      dot: 'bg-amber-400',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200'
    },
    UNKNOWN: {
      dot: 'bg-zinc-500',
      bg: 'bg-zinc-100',
      text: 'text-zinc-700',
      border: 'border-zinc-200'
    },
    DISCONNECTED: {
      dot: 'bg-rose-400',
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200'
    }
  };

  const tone = tones[value] ?? tones.UNKNOWN;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${tone.bg} ${tone.text} ${tone.border}`}
    >
      {tone.pulse ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      ) : (
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      )}
      {statusLabel[value]}
    </span>
  );
}
