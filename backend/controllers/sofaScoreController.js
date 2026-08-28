'use strict';

const dataProvider = require('../models/dataProvider');

const SOFASCORE_BASE = 'https://www.sofascore.com/api/v1';
const PREMIER_LEAGUE_ID = 17;
const TTL_EVENTS = 60 * 1000;
const TTL_INCIDENTS = 30 * 1000;
const SOFASCORE_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://www.sofascore.com',
  Referer: 'https://www.sofascore.com/',
};

const fetchSofaScore = (path, ttlMs) =>
  dataProvider.cachedGet(`${SOFASCORE_BASE}${path}`, ttlMs, SOFASCORE_HEADERS);

const minuteLabel = (incident) => {
  if (incident.time == null) return '';
  return incident.addedTime ? `${incident.time}'+${incident.addedTime}'` : `${incident.time}'`;
};

const parseGoal = (incident, event) => ({
  icon: 'goal',
  minute: minuteLabel(incident),
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

const getScoreboard = async (req, res) => {
  try {
    const { dates } = req.query;
    if (dates !== undefined && typeof dates !== 'string') {
      return res.status(400).json({ error: 'Invalid dates parameter — expected YYYYMMDD' });
    }
    if (dates !== undefined && (typeof dates !== 'string' || !/^\d{8}$/.test(dates))) {
      return res.status(400).json({ error: 'Invalid dates parameter — expected YYYYMMDD' });
    }
    const date = dates
      ? `${dates.slice(0, 4)}-${dates.slice(4, 6)}-${dates.slice(6)}`
      : new Date().toISOString().slice(0, 10);
    const data = await fetchSofaScore(`/sport/football/scheduled-events/${date}`, TTL_EVENTS);
    const events = (data.events ?? []).filter(event => event.tournament?.uniqueTournament?.id === PREMIER_LEAGUE_ID);
    const matches = await Promise.all(events.map(async event => {
      try {
        const incidents = await fetchSofaScore(`/event/${event.id}/incidents`, TTL_INCIDENTS);
        return parseEvent(event, incidents.incidents ?? []);
      } catch (error) {
        console.warn(`[SofaScore] incidents unavailable for event ${event.id}:`, error.message);
        return parseEvent(event);
      }
    }));
    res.json(matches);
  } catch (error) {
    console.error('[SofaScore] getScoreboard error:', error.message);
    res.status(502).json({ error: 'Failed to fetch SofaScore events' });
  }
};

const getSummary = async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.eventId)) {
      return res.status(400).json({ error: 'Invalid SofaScore event ID' });
    }
    const [eventData, incidentsData] = await Promise.all([
      fetchSofaScore(`/event/${req.params.eventId}`, TTL_EVENTS),
      fetchSofaScore(`/event/${req.params.eventId}/incidents`, TTL_INCIDENTS),
    ]);
    const event = eventData.event;
    if (!event) return res.status(404).json({ error: 'SofaScore event not found' });
    res.json({ events: parseEvent(event, incidentsData.incidents ?? []).details });
  } catch (error) {
    console.error('[SofaScore] getSummary error:', error.message);
    res.status(502).json({ error: 'Failed to fetch SofaScore incidents' });
  }
};

module.exports = { getScoreboard, getSummary, parseEvent, parseIncident };
