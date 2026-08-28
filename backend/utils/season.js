'use strict';

/**
 * Resolve season and gameweek state from bootstrap events.
 *
 * FPL's committed/static bootstrap data normally identifies the current event
 * with is_current. That flag can lag behind the event data, so finished state
 * and the deadline are used as the source of truth when resolving the season.
 */
const getSeasonState = (events, now = new Date()) => {
  if (!Array.isArray(events) || events.length === 0) {
    return { seasonStarted: true, currentEvent: null, currentGameweek: 1 };
  }

  const nowMs = now.getTime();
  const deadlineHasPassed = event => {
    const deadlineMs = Date.parse(event.deadline_time ?? '');
    return Number.isFinite(deadlineMs) && deadlineMs <= nowMs;
  };
  const startedEvents = events.filter(event =>
    event.finished || event.is_current || deadlineHasPassed(event)
  );
  const currentGameweek = startedEvents.length
    ? startedEvents.reduce((latest, event) => Math.max(latest, event.id), 0)
    : events[0].id;
  const currentEvent = events.find(event => event.id === currentGameweek)
    || events.find(event => event.is_current && !event.finished && !event.is_next)
    || events.find(event => event.is_next)
    || events.find(event => event.id === currentGameweek)
    || events[0];

  return {
    seasonStarted: startedEvents.length > 0,
    currentEvent,
    currentGameweek,
    isEventActive: event => !!event && !event.finished && event.id === currentGameweek,
  };
};

module.exports = { getSeasonState };