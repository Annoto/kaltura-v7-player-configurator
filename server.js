'use strict';

const path = require('path');
const express = require('express');
const {
  DEFAULT_SERVICE_URL,
  BUNDLER_PLUGIN_NAME,
  CONFIG_PLUGIN_KEY,
  DEFAULT_VERSION,
  mergeConfVars,
  mergeConfig,
  startSession,
  getUiConf,
  cloneUiConf,
  updateUiConf
} = require('./lib/kaltura');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8090;
const HOST = '127.0.0.1'; // local-only by design (admin secret never leaves your machine)

function pickInputs(body) {
  const b = body || {};
  return {
    serviceUrl: (b.serviceUrl || DEFAULT_SERVICE_URL).trim(),
    partnerId: String(b.partnerId || '').trim(),
    adminSecret: String(b.adminSecret || '').trim(),
    uiConfId: String(b.uiConfId || '').trim(),
    version: (b.version || DEFAULT_VERSION).trim(),
    clientId: String(b.clientId || '').trim(),
    region: (b.region || '').trim(),
    operationMode: String(b.operationMode || 'update-both').trim(),
    cloneMode: b.cloneMode === true
  };
}

function validate(i) {
  const errors = [];
  if (!i.partnerId) errors.push('Partner ID is required');
  if (!i.adminSecret) errors.push('Admin Secret is required');
  if (!i.uiConfId) errors.push('Player / uiConf ID is required');
  const configModes = ['update-config-only', 'update-both', 'clean-config-only'];
  if (configModes.includes(i.operationMode) && !i.clientId) {
    errors.push('Annoto clientId is required for this operation mode');
  }
  return errors;
}

// Check if Annoto is already configured on the player
function checkAnnotoStatus(uiConf) {
  const confVars = uiConf.confVars ? JSON.parse(uiConf.confVars) : {};
  const config = uiConf.config ? JSON.parse(uiConf.config) : {};

  const versionsEntry = confVars.versions ? confVars.versions[BUNDLER_PLUGIN_NAME] : null;
  const configEntry = config.plugins ? config.plugins[CONFIG_PLUGIN_KEY] : null;

  return {
    hasVersions: !!versionsEntry,
    versionsValue: versionsEntry || null,
    hasConfig: !!configEntry,
    configValue: configEntry || null,
    isConfigured: !!(versionsEntry || configEntry)
  };
}

/** Compute what the change would look like against the current uiConf. */
function computePlan(uiConf, i) {
  const confVars = uiConf.confVars ? JSON.parse(uiConf.confVars) : {};
  const config = uiConf.config ? JSON.parse(uiConf.config) : {};

  const plan = {
    player: { id: uiConf.id, name: uiConf.name },
    operationMode: i.operationMode,
    before: {
      hasVersions: !!confVars.versions?.[BUNDLER_PLUGIN_NAME],
      versionsValue: confVars.versions?.[BUNDLER_PLUGIN_NAME] || null,
      hasConfig: !!config.plugins?.[CONFIG_PLUGIN_KEY],
      configValue: config.plugins?.[CONFIG_PLUGIN_KEY] || null
    },
    after: {
      confVars: JSON.parse(JSON.stringify(confVars)),
      config: JSON.parse(JSON.stringify(config))
    },
    changes: { versionsChanged: false, configChanged: false }
  };

  // Apply operation based on mode
  switch (i.operationMode) {
    case 'update-both':
      // Add/update versions
      if (!plan.after.confVars.versions) plan.after.confVars.versions = {};
      plan.after.confVars.versions[BUNDLER_PLUGIN_NAME] = i.version;
      plan.changes.versionsChanged = plan.before.versionsValue !== i.version;

      // Add/update config
      if (!plan.after.config.plugins) plan.after.config.plugins = {};
      plan.after.config.plugins[CONFIG_PLUGIN_KEY] = { clientId: i.clientId, region: i.region };
      plan.changes.configChanged = true;
      break;

    case 'update-versions-only':
      // Add/update versions only
      if (!plan.after.confVars.versions) plan.after.confVars.versions = {};
      plan.after.confVars.versions[BUNDLER_PLUGIN_NAME] = i.version;
      plan.changes.versionsChanged = plan.before.versionsValue !== i.version;
      break;

    case 'update-config-only':
      // Add/update config only
      if (!plan.after.config.plugins) plan.after.config.plugins = {};
      plan.after.config.plugins[CONFIG_PLUGIN_KEY] = { clientId: i.clientId, region: i.region };
      plan.changes.configChanged = true;
      break;

    case 'clean-all':
      // Remove both versions and config
      if (plan.after.confVars.versions) {
        delete plan.after.confVars.versions[BUNDLER_PLUGIN_NAME];
      }
      if (plan.after.config.plugins) {
        delete plan.after.config.plugins[CONFIG_PLUGIN_KEY];
      }
      plan.changes.versionsChanged = plan.before.hasVersions;
      plan.changes.configChanged = plan.before.hasConfig;
      break;

    case 'clean-versions-only':
      // Remove versions only
      if (plan.after.confVars.versions) {
        delete plan.after.confVars.versions[BUNDLER_PLUGIN_NAME];
      }
      plan.changes.versionsChanged = plan.before.hasVersions;
      break;

    case 'clean-config-only':
      // Remove config only
      if (plan.after.config.plugins) {
        delete plan.after.config.plugins[CONFIG_PLUGIN_KEY];
      }
      plan.changes.configChanged = plan.before.hasConfig;
      break;
  }

  plan.after.confVarsJson = JSON.stringify(plan.after.confVars);
  plan.after.configJson = JSON.stringify(plan.after.config);

  return plan;
}

// GET /api/check - Check current Annoto configuration status
app.get('/api/check', async (req, res) => {
  const serviceUrl = (req.query.serviceUrl || DEFAULT_SERVICE_URL).trim();
  const partnerId = String(req.query.partnerId || '').trim();
  const adminSecret = String(req.query.adminSecret || '').trim();
  const uiConfId = String(req.query.uiConfId || '').trim();

  const errors = [];
  if (!partnerId) errors.push('Partner ID is required');
  if (!adminSecret) errors.push('Admin Secret is required');
  if (!uiConfId) errors.push('Player / uiConf ID is required');

  if (errors.length) return res.status(400).json({ ok: false, errors });

  try {
    const ks = await startSession(serviceUrl, partnerId, adminSecret);
    const uiConf = await getUiConf(serviceUrl, ks, uiConfId);
    const status = checkAnnotoStatus(uiConf);

    res.json({
      ok: true,
      player: { id: uiConf.id, name: uiConf.name },
      annoto: status,
      currentConfVars: uiConf.confVars || '',
      currentConfig: uiConf.config || ''
    });
  } catch (e) {
    res.status(500).json({ ok: false, errors: [e.message] });
  }
});

// POST /api/preview - Preview what changes would be made
app.post('/api/preview', async (req, res) => {
  const i = pickInputs(req.body);
  const errors = validate(i);
  if (errors.length) return res.status(400).json({ ok: false, errors });
  try {
    const ks = await startSession(i.serviceUrl, i.partnerId, i.adminSecret);
    const uiConf = await getUiConf(i.serviceUrl, ks, i.uiConfId);
    const plan = computePlan(uiConf, i);

    res.json({
      ok: true,
      plan
    });
  } catch (e) {
    res.status(500).json({ ok: false, errors: [e.message] });
  }
});

// POST /api/apply - Apply the changes to the player
app.post('/api/apply', async (req, res) => {
  const i = pickInputs(req.body);
  const errors = validate(i);
  if (errors.length) return res.status(400).json({ ok: false, errors });
  try {
    const ks = await startSession(i.serviceUrl, i.partnerId, i.adminSecret);

    // Optionally clone into a new dedicated player first.
    let targetId = i.uiConfId;
    let cloned = null;
    if (i.cloneMode) {
      const clone = await cloneUiConf(i.serviceUrl, ks, i.uiConfId);
      targetId = clone.id;
      cloned = { id: clone.id, name: clone.name };
    }

    const uiConf = await getUiConf(i.serviceUrl, ks, targetId);
    const plan = computePlan(uiConf, i);

    // Apply the changes
    const updatePayload = {
      confVars: plan.after.confVarsJson,
      config: plan.after.configJson
    };

    await updateUiConf(i.serviceUrl, ks, targetId, updatePayload);

    // Verify by re-fetching
    const after = await getUiConf(i.serviceUrl, ks, targetId);
    const afterStatus = checkAnnotoStatus(after);

    res.json({
      ok: true,
      cloned,
      targetId,
      operationMode: i.operationMode,
      applied: plan.changes,
      verified: afterStatus,
      afterConfVars: after.confVars || '',
      afterConfig: after.config || ''
    });
  } catch (e) {
    res.status(500).json({ ok: false, errors: [e.message] });
  }
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Annoto × Kaltura configurator running at http://${HOST}:${PORT}`);
});
