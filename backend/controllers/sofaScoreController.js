'use strict';

const dataProvider = require('../models/dataProvider');

const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1';
const PREMIER_LEAGUE_ID = 17;
const TTL_EVENTS = 60 * 1000;
const TTL_INCIDENTS = 30 * 1000;
const SOFASCORE_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://www.sofascore.com',
  Referer: 'https://www.sofascore.com/',
};

const minuteLabel = (incident) => {
  if (incident.time == null) return '';
  return incident.addedTime ? `${incident.time}'+${incident.addedTime}'` : `${incident.time}'`;
};

const fetchSofaScore = (path, ttlMs) =>
  dataProvider.cachedGet(`${SOFASCORE_BASE}${path}`, ttlMs, SOFASCORE_HEADERS);

const normaliseName = (name) => (name ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const teamNamesMatch = (left, right) => {
  const a = normaliseName(left);
  const b = normaliseName(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
};

const eventKickoff = (event) => {
  const timestamp = Number(event.startTimestamp);
  return Number.isFinite(timestamp) ? timestamp * 1000 : NaN;
};

const fixtureMatchesEvent = (fixture, event) => {
  if (event.tournament?.uniqueTournament?.id !== PREMIER_LEAGUE_ID) return false;
  if (!teamNamesMatch(fixture.team_h_name, event.homeTeam?.name)
    || !teamNamesMatch(fixture.team_a_name, event.awayTeam?.name)) return false;

  const fixtureTime = new Date(fixture.kickoff_time).getTime();
  const eventTime = eventKickoff(event);
  return Number.isFinite(fixtureTime) && Number.isFinite(eventTime)
    && Math.abs(fixtureTime - eventTime) <= 36 * 60 * 60 * 1000;
};

const mapLimit = async (items, limit, mapper) => {
  const results = [];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

const findTeamId = async (name) => {
  const data = await fetchSofaScore(`/search/all?q=${encodeURIComponent(name)}`, TTL_EVENTS);
  const teams = (data.results ?? [])
    .filter(result => result.entity?.sport?.slug === 'football' && result.entity?.name)
    .map(result => result.entity)
    .filter(team => teamNamesMatch(name, team.name));
  return teams[0]?.id ?? null;
};

const fetchTeamEvents = async (teamId) => {
  const pages = await Promise.all([
    fetchSofaScore(`/team/${teamId}/events/last/0`, TTL_EVENTS),
    fetchSofaScore(`/team/${teamId}/events/next/0`, TTL_EVENTS),
  ]);
  return pages.flatMap(page => page.events ?? []);
};

const findSofaScoreEvent = (fixture, events) =>
  events.find(event => fixtureMatchesEvent(fixture, event)) ?? null;

const parseGoalIncident = (incident) => ({
  minute: Number(incident.time),
  addedTime: incident.addedTime == null ? null : Number(incident.addedTime),
  scorerName: incident.player?.name ?? null,
  assisterName: incident.assist1?.name ?? incident.assist2?.name ?? null,
  scorerSofaScoreId: incident.player?.id ?? null,
  assisterSofaScoreId: incident.assist1?.id ?? incident.assist2?.id ?? null,
});

const parseGoalIncidents = (incidents) => incidents
  .filter(incident => incident.incidentType === 'goal' && incident.time != null)
  .map(parseGoalIncident);

const normaliseFixtureName = (name) => (name ?? '').toLowerCase().replace(/[^a-z]/g, '');

const findIncident = (event, incidents) => {
  const playerName = normaliseFixtureName(event.player);
  if (!playerName) return null;
  return incidents.find(incident => {
    const incidentName = normaliseFixtureName(event.icon === 'assist'
      ? incident.assisterName
      : incident.scorerName);
    return incidentName && (incidentName.includes(playerName) || playerName.includes(incidentName));
  }) ?? null;
};

const formatIncidentMinute = (incident) => {
  if (!incident || incident.minute == null) return null;
  return incident.addedTime == null ? `${incident.minute}'` : `${incident.minute}'+${incident.addedTime}'`;
};

const buildFixtureEvents = (fixture, sofaScoreIncidents = []) => {
  const eventStats = (fixture.stats ?? []).filter(stat => [
    'goals_scored', 'assists', 'own_goals', 'yellow_cards', 'red_cards',
  ].includes(stat.identifier));
  const events = eventStats.flatMap(stat => {
    const icon = stat.identifier === 'goals_scored' || stat.identifier === 'own_goals'
      ? 'goal'
      : stat.identifier === 'assists' ? 'assist'
        : stat.identifier === 'yellow_cards' ? 'yellow' : 'red';
    return ['h', 'a'].flatMap(side => (stat[side] ?? []).flatMap(entry =>
      Array.from({ length: entry.value || 1 }, () => ({
        icon,
        player: entry.webName,
        teamId: side === 'h' ? fixture.team_h : fixture.team_a,
        ownGoal: stat.identifier === 'own_goals',
        minute: entry.minute ?? null,
      }))
    ));
  }).map(event => ({
    ...event,
    minute: formatIncidentMinute(findIncident(event, sofaScoreIncidents)) ?? event.minute,
  })).sort((left, right) => {
    if (left.minute == null && right.minute == null) return 0;
    if (left.minute == null) return 1;
    if (right.minute == null) return -1;
    return parseFloat(left.minute) - parseFloat(right.minute);
  });

  const displayEvents = [];
  events.forEach(event => {
    if (event.icon === 'assist') {
      const goal = displayEvents.find(item => item.icon === 'goal'
        && item.teamId === event.teamId
        && item.minute === event.minute
        && !item.assist);
      if (goal) {
        goal.assist = event.player;
        return;
      }
    }
    displayEvents.push({ ...event });
  });
  return displayEvents;
};

const mergeFixtureEvents = (fixture, sofaEvents, espnDetails = []) => {
  const normalise = (value) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const events = [...sofaEvents];
  espnDetails
    .filter(event => ['goal', 'yellow', 'red'].includes(event.icon))
    .map(event => ({
      ...event,
      teamId: String(event.teamId) === String(fixture.espnHomeId)
        ? fixture.team_h
        : String(event.teamId) === String(fixture.espnAwayId) ? fixture.team_a : event.teamId,
    }))
    .forEach(event => {
      const duplicate = events.some(existing => existing.icon === event.icon
        && existing.teamId === event.teamId
        && existing.minute === event.minute
        && normalise(existing.player) === normalise(event.player));
      if (!duplicate) events.push(event);
    });
  return events.sort((left, right) => {
    if (left.minute == null && right.minute == null) return 0;
    if (left.minute == null) return 1;
    if (right.minute == null) return -1;
    return parseFloat(left.minute) - parseFloat(right.minute);
  });
};

const parseGoal = (incident, event) => ({
  icon: 'goal',
  minute: incident.time == null ? '' : incident.addedTime ? `${incident.time}'+${incident.addedTime}'` : `${incident.time}'`,
  teamId: incident.isHome ? event.homeTeam?.id : event.awayTeam?.id,
  player: incident.player?.name ?? '',
  secondPlayer: incident.assist1?.name ?? incident.assist2?.name ?? '',
  ownGoal: incident.incidentClass === 'ownGoal',
  penaltyKick: incident.incidentClass === 'penalty',
});

const parseCard = (incident, event) => ({
  icon: incident.incidentClass === 'red' || incident.incidentClass === 'yellowRed' ? 'red' : 'yellow',
  minute: minuteLabel(incident),
  teamId: incident.isHome ? event.homeTeam?.id : event.awayTeam?.id,
  player: incident.player?.name ?? '',
  secondPlayer: '',
  ownGoal: false,
  penaltyKick: false,
});

const parseIncident = (incident, event) => {
  if (incident.incidentType === 'goal') return parseGoal(incident, event);
  if (incident.incidentType === 'card') return parseCard(incident, event);
  return null;
};

const parseEvent = (event, incidents = []) => ({
  sofaScoreId: event.id,
  homeName: event.homeTeam?.name ?? '',
  awayName: event.awayTeam?.name ?? '',
  homeAbbr: event.homeTeam?.nameCode ?? event.homeTeam?.shortName ?? '',
  awayAbbr: event.awayTeam?.nameCode ?? event.awayTeam?.shortName ?? '',
  homeScore: event.homeScore?.current ?? event.homeScore?.normaltime ?? 0,
  awayScore: event.awayScore?.current ?? event.awayScore?.normaltime ?? 0,
  homeId: event.homeTeam?.id,
  awayId: event.awayTeam?.id,
  state: event.status?.type === 'finished' ? 'post' : event.status?.type === 'inprogress' ? 'in' : 'pre',
  isLive: event.status?.type === 'inprogress',
  isFinished: event.status?.type === 'finished',
  clock: event.status?.description ?? '',
  statusDetail: event.status?.description ?? '',
  details: incidents
    .map(incident => parseIncident(incident, event))
    .filter(Boolean)
    .sort((left, right) => parseFloat(left.minute || 'Infinity') - parseFloat(right.minute || 'Infinity')),
});

const getFixtureIncidents = async (req, res) => {
  const fixtures = req.body?.fixtures;
  if (!Array.isArray(fixtures) || fixtures.length > 50) {
    return res.status(400).json({ error: 'fixtures must be an array with at most 50 entries' });
  }

  try {
    const teamNames = [...new Set(fixtures.flatMap(fixture => [fixture.team_h_name, fixture.team_a_name]).filter(Boolean))];
    const teamIds = await mapLimit(teamNames, 4, async name => [name, await findTeamId(name)]);
    const eventsByTeam = new Map(await mapLimit(
      teamIds.filter(([, id]) => id),
      4,
      async ([name, id]) => [name, await fetchTeamEvents(id)],
    ));
    const resolved = fixtures.map(fixture => {
      const homeEvents = eventsByTeam.get(fixture.team_h_name) ?? [];
      const awayEvents = eventsByTeam.get(fixture.team_a_name) ?? [];
      const event = findSofaScoreEvent(fixture, [...homeEvents, ...awayEvents]);
      return { fixtureId: fixture.id, event };
    });
    const uniqueEvents = [...new Map(resolved.filter(item => item.event).map(item => [item.event.id, item.event])).values()];
    const incidentEntries = await mapLimit(uniqueEvents, 4, async event => {
      try {
        const data = await fetchSofaScore(`/event/${event.id}/incidents`, TTL_INCIDENTS);
        return [event.id, parseGoalIncidents(data.incidents ?? [])];
      } catch (error) {
        console.warn(`[SofaScore] incidents unavailable for /event/${event.id}/incidents (HTTP ${error.response?.status ?? 'network'}):`, error.message);
        return [event.id, []];
      }
    });
    const incidentsByEvent = new Map(incidentEntries);
    res.json(resolved.map(({ fixtureId, event }) => ({
      fixtureId,
      sofaScoreEventId: event?.id ?? null,
      sofaScoreIncidents: event ? incidentsByEvent.get(event.id) ?? [] : [],
    })));
  } catch (error) {
    console.error('[SofaScore] getFixtureIncidents error:', error.message);
    res.json(fixtures.map(fixture => ({ fixtureId: fixture.id, sofaScoreEventId: null, sofaScoreIncidents: [] })));
  }
};

const enrichFixturesWithIncidents = async (fixtures) => {
  const teamNames = [...new Set(fixtures.flatMap(fixture => [fixture.team_h_name, fixture.team_a_name]).filter(Boolean))];
  const teamIds = await mapLimit(teamNames, 4, async name => [name, await findTeamId(name)]);
  const eventsByTeam = new Map(await mapLimit(
    teamIds.filter(([, id]) => id),
    4,
    async ([name, id]) => [name, await fetchTeamEvents(id)],
  ));
  const resolved = fixtures.map(fixture => {
    const homeEvents = eventsByTeam.get(fixture.team_h_name) ?? [];
    const awayEvents = eventsByTeam.get(fixture.team_a_name) ?? [];
    return { fixture, event: findSofaScoreEvent(fixture, [...homeEvents, ...awayEvents]) };
  });
  const uniqueEvents = [...new Map(resolved.filter(item => item.event).map(item => [item.event.id, item.event])).values()];
  const incidentEntries = await mapLimit(uniqueEvents, 4, async event => {
    try {
      const data = await fetchSofaScore(`/event/${event.id}/incidents`, TTL_INCIDENTS);
      return [event.id, parseGoalIncidents(data.incidents ?? [])];
    } catch (error) {
      console.warn(`[SofaScore] incidents unavailable for /event/${event.id}:`, error.message);
      return [event.id, []];
    }
  });
  const incidentsByEvent = new Map(incidentEntries);
  return fixtures.map(fixture => {
    const match = resolved.find(item => item.fixture.id === fixture.id);
    return {
      ...fixture,
      events: buildFixtureEvents(fixture, match?.event ? incidentsByEvent.get(match.event.id) ?? [] : []),
    };
  });
};

const getSummary = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (typeof eventId !== 'string' || !/^\d+$/.test(eventId)) {
      return res.status(400).json({ error: 'Invalid SofaScore event ID' });
    }
    const [eventData, incidentsData] = await Promise.all([
      fetchSofaScore(`/event/${eventId}`, TTL_EVENTS),
      fetchSofaScore(`/event/${eventId}/incidents`, TTL_INCIDENTS),
    ]);
    const event = eventData.event;
    if (!event) return res.status(404).json({ error: 'SofaScore event not found' });
    res.json({ events: parseEvent(event, incidentsData.incidents ?? []).details });
  } catch (error) {
    console.error('[SofaScore] getSummary error:', error.message);
    res.status(502).json({ error: 'Failed to fetch SofaScore incidents' });
  }
};

module.exports = {
  getFixtureIncidents,
  enrichFixturesWithIncidents,
  buildFixtureEvents,
  mergeFixtureEvents,
  getSummary,
  parseEvent,
  parseIncident,
  parseGoalIncident,
  parseGoalIncidents,
  findSofaScoreEvent,
};
