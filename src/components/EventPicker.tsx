import { ALL_EVENTS, useData, useEvent } from '../data/DataContext';

/** Global contest-event selector (persisted). `allowAll` adds an "All events" option. */
export function EventPicker({ allowAll = true, compact = false }: { allowAll?: boolean; compact?: boolean }) {
  const { factEvents } = useData();
  const { event, setEvent } = useEvent();
  if (factEvents.length < 2) return null;
  if (compact)
    return (
      <label className="event-select small">
        Event{' '}
        <select value={event === ALL_EVENTS && !allowAll ? '' : event} onChange={(e) => setEvent(e.target.value)} aria-label="Contest event">
          {!allowAll && event === ALL_EVENTS && <option value="">Choose…</option>}
          {factEvents.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
          {allowAll && <option value={ALL_EVENTS}>All events</option>}
        </select>
      </label>
    );
  return (
    <div className="chips" role="radiogroup" aria-label="Contest event">
      {factEvents.map((e) => (
        <button key={e.id} role="radio" aria-checked={event === e.id} className={`chip ${event === e.id ? 'on' : ''}`} onClick={() => setEvent(e.id)}>
          {e.name}
        </button>
      ))}
      {allowAll && (
        <button role="radio" aria-checked={event === ALL_EVENTS} className={`chip ${event === ALL_EVENTS ? 'on' : ''}`} onClick={() => setEvent(ALL_EVENTS)}>
          All events
        </button>
      )}
    </div>
  );
}
