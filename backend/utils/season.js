'use strict';

/**
 * Resolve season and gameweek state from bootstrap events.
 *
 * FPL's committed/static bootstrap data identifies the current event with
 * is_current. The deadline marks the end of planning, not the start of an
 * active gameweek for this application's display.
 */
const getSeasonState = (events, now = new Date()) => {
  if (!Array.isArray(events) || events.length === 0) {
    return { seasonStarted: true, currentEvent: null, currentGameweek: 1 };
  }

  const activeEvents = events.filter(event =>
    !event.finished && event.is_current && !event.is_next
  );
  const startedEvents = events.filter(event =>
    event.finished || (event.is_current && !event.is_next)
  );
  const currentGameweek = startedEvents.length
    ? startedEvents.reduce((latest, event) => Math.max(latest, event.id), 0)
    : events[0].id;
  const currentEvent = events.find(event => event.is_current && !event.finished && !event.is_next)
    || activeEvents.sort((left, right) => right.id - left.id)[0]
    || events.find(event => event.id === currentGameweek)
    || events[0];

  return {
    seasonStarted: startedEvents.length > 0,
    currentEvent,
    currentGameweek,
    isEventActive: event => !!event && !event.finished &&
      event.is_current && !event.is_next,
  };
};

module.exports = { getSeasonState };