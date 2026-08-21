'use strict';

/**
 * Resolve season and gameweek state from bootstrap events.
 *
 * FPL's committed/static bootstrap data can lag behind the deadline flags,
 * so deadline_time is used as a fallback for the current clock.
 */
const getSeasonState = (events, now = new Date()) => {
  if (!Array.isArray(events) || events.length === 0) {
    return { seasonStarted: true, currentEvent: null, currentGameweek: 1 };
  }

  const nowMs = now.getTime();
  const deadlinePassed = event => {
    const deadlineMs = Date.parse(event.deadline_time);
    return Number.isFinite(deadlineMs) && deadlineMs <= nowMs;
  };

  const activeEvents = events.filter(event =>
    !event.finished && (event.is_current || deadlinePassed(event))
  );
  const currentEvent = events.find(event => event.is_current && !event.finished)
    || activeEvents.sort((left, right) => right.id - left.id)[0]
    || events.find(event => !event.finished)
    || events[events.length - 1];
  const startedEvents = events.filter(event =>
    event.finished || event.is_current || deadlinePassed(event)
  );
  const currentGameweek = startedEvents.length
    ? startedEvents.reduce((latest, event) => Math.max(latest, event.id), 0)
    : events[0].id;

  return {
    seasonStarted: startedEvents.length > 0,
    currentEvent,
    currentGameweek,
    isEventActive: event => !!event && !event.finished &&
      (event.is_current || deadlinePassed(event)),
  };
};

module.exports = { getSeasonState };