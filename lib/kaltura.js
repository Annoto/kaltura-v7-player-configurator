'use strict';

/**
 * Kaltura API helpers + non-destructive merge logic for enabling the Annoto
 * plugin on a V7 player (uiConf).
 *
 * Two fields on the uiConf matter (confirmed with Kaltura PS / Muli Dayan):
 *   - confVars: JSON string. Its `versions` map lists the player plugins to
 *     include in the bundle. We add "playkit-annoto-loader": "{latest}" without
 *     touching existing entries. (This field is NOT editable in the KMC UI.)
 *   - config: JSON string of the runtime player config. We add the plugin config
 *     under plugins["annoto-loader"] (clientId, region), merging non-destructively.
 */

const DEFAULT_SERVICE_URL = 'https://cdnapisec.kaltura.com';
const BUNDLER_PLUGIN_NAME = 'playkit-annoto-loader'; // key in confVars.versions
const CONFIG_PLUGIN_KEY = 'annoto-loader'; // key in config.plugins
const DEFAULT_VERSION = '{latest}';

/** Parse a Kaltura JSON-string field defensively. Empty → {}. Invalid → throw. */
function parseJsonField(value, fieldName) {
  if (value === undefined || value === null) return {};
  if (typeof value === 'object') return value;
  const str = String(value).trim();
  if (!str) return {};
  try {
    return JSON.parse(str);
  } catch (e) {
    throw new Error(
      `Existing "${fieldName}" is not valid JSON — aborting so nothing is clobbered. ` +
        `Please inspect it manually. Raw value: ${str.slice(0, 400)}`
    );
  }
}

/**
 * Merge the plugin version into confVars.versions without removing existing
 * entries. Returns { confVars (object), before, after, changed }.
 */
function mergeConfVars(existingConfVars, { pluginName = BUNDLER_PLUGIN_NAME, version = DEFAULT_VERSION } = {}) {
  const confVars = parseJsonField(existingConfVars, 'confVars');
  if (!confVars.versions || typeof confVars.versions !== 'object') {
    confVars.versions = {};
  }
  const before = confVars.versions[pluginName];
  confVars.versions[pluginName] = version;
  return { confVars, before, after: version, changed: before !== version };
}

/**
 * Merge the Annoto plugin config into config.plugins["annoto-loader"] without
 * removing other plugins or keys. Returns { config (object), before, after }.
 */
function mergeConfig(existingConfig, { clientId, region, configKey = CONFIG_PLUGIN_KEY } = {}) {
  const config = parseJsonField(existingConfig, 'config');
  if (!config.plugins || typeof config.plugins !== 'object') {
    config.plugins = {};
  }
  const before = config.plugins[configKey];
  const merged = Object.assign({}, before);
  if (clientId !== undefined && clientId !== '') merged.clientId = clientId;
  if (region !== undefined && region !== '') merged.region = region;
  config.plugins[configKey] = merged;
  return { config, before, after: merged };
}

/** Low-level Kaltura api_v3 REST call. Returns parsed JSON; throws on API error. */
async function kalturaCall(serviceUrl, service, action, params) {
  const base = (serviceUrl || DEFAULT_SERVICE_URL).replace(/\/+$/, '');
  const url = `${base}/api_v3/service/${service}/action/${action}`;
  const body = new URLSearchParams(Object.assign({ format: '1' }, params));
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Non-JSON response from Kaltura (${res.status}): ${text.slice(0, 300)}`);
  }
  if (json && json.objectType === 'KalturaAPIException') {
    throw new Error(`Kaltura API error [${json.code}]: ${json.message}`);
  }
  return json;
}

/** Start an ADMIN Kaltura session (KS) from the partner's admin secret. */
async function startSession(serviceUrl, partnerId, adminSecret) {
  const ks = await kalturaCall(serviceUrl, 'session', 'start', {
    secret: adminSecret,
    type: '2', // ADMIN
    partnerId: String(partnerId),
    expiry: '3600'
  });
  if (typeof ks !== 'string' || !ks) {
    throw new Error('Failed to obtain a Kaltura session (unexpected response).');
  }
  return ks;
}

/** Fetch a uiConf (player) by id. */
async function getUiConf(serviceUrl, ks, id) {
  return kalturaCall(serviceUrl, 'uiconf', 'get', { ks, id: String(id) });
}

/** Clone an existing uiConf; returns the new uiConf (with a new id). */
async function cloneUiConf(serviceUrl, ks, id) {
  return kalturaCall(serviceUrl, 'uiconf', 'clone', { ks, id: String(id) });
}

/** Update a uiConf's confVars and/or config (both passed as JSON strings). */
async function updateUiConf(serviceUrl, ks, id, { confVars, config, name } = {}) {
  const params = { ks, id: String(id) };
  if (confVars !== undefined) params['uiConf[confVars]'] = confVars;
  if (config !== undefined) params['uiConf[config]'] = config;
  if (name !== undefined) params['uiConf[name]'] = name;
  return kalturaCall(serviceUrl, 'uiconf', 'update', params);
}

module.exports = {
  DEFAULT_SERVICE_URL,
  BUNDLER_PLUGIN_NAME,
  CONFIG_PLUGIN_KEY,
  DEFAULT_VERSION,
  parseJsonField,
  mergeConfVars,
  mergeConfig,
  kalturaCall,
  startSession,
  getUiConf,
  cloneUiConf,
  updateUiConf
};
