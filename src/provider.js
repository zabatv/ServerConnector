// src/provider.js — one lookup entry point, two sources.
//
//   api      PROVIDER=api + key     open.faceit.com Data API
//   browser  default without a key  the collector (src/collect.js): drives the
//                                   signed-in Chrome and asks the page for its
//                                   own JSON
//
// The rest of the app never asks which one ran; it gets { player, stats, provider }.

import * as faceit from './faceit.js';
import * as collect from './collect.js';

export class LookupError extends Error {
  constructor(message, { code = 'lookup_error', status = 0 } = {}) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const provider_name = () => {
  const forced = (process.env.PROVIDER || '').toLowerCase();
  if (forced === 'api' || forced === 'browser') return forced;
  return faceit.has_api_key() ? 'api' : 'browser';
};

export function status() {
  const provider = provider_name();
  return {
    provider,
    api_key: faceit.has_api_key(),
    oauth: faceit.has_oauth(),
    browser: collect.has_browser() ? (process.env.CHROME_CDP || 'http://127.0.0.1:9222') : null,
  };
}

const TTL_MINUTES = () => Number(process.env.COLLECT_TTL_MINUTES || 360);

export async function lookup(nickname, { cached } = {}) {
  const provider = provider_name();

  if (cached && cached.fetched_at && Date.now() - cached.fetched_at < TTL_MINUTES() * 60_000) {
    return {
      player: { ...cached, stats: undefined },
      stats: cached.stats_json ? JSON.parse(cached.stats_json) : null,
      provider: cached.source || provider,
      cached: true,
    };
  }

  if (provider === 'api') {
    const player = await faceit.resolve(nickname);
    let stats = null;
    try { stats = await faceit.stats(player.player_id); } catch { /* missing CS2 history is not a failure */ }
    return { player: { ...player, source: 'api' }, stats, provider: 'api' };
  }

  try {
    const out = await collect.collect(nickname);
    return { ...out, provider: 'browser' };
  } catch (err) {
    if (err instanceof collect.CollectError) {
      throw new LookupError(err.message, { code: err.code, status: err.status });
    }
    throw err;
  }
}
