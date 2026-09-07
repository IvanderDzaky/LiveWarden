import { Suspense } from 'react';
import { EventManagement } from '../../../components/events/event-management';
import { LoadingState } from '../../../components/ui/loading-state';

export default function EventsPage() {
  return (
    <section aria-labelledby="events-heading">
      <Suspense fallback={<LoadingState message="Loading event logs..." />}>
        <EventManagement />
      </Suspense>
    </section>
  );
}
