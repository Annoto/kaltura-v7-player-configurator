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
    setConfig: b.setConfig !== false, // default true
    mode: b.mode === 'clone' ? 'clone' : 'update'
  };
}

function validate(i) {
  const errors = [];
  if (!i.partnerId) errors.push('partnerId is required');
  if (!i.adminSecret) errors.push('adminSecret is required');
  if (!i.uiConfId) errors.push('player / uiConf ID is required');
  if (i.setConfig && !i.clientId) errors.push('clientId is required when setting the plugin config');
  return errors;
}

/** Compute what the change would look like against the current uiConf. */
function computePlan(uiConf, i) {
  const cv = mergeConfVars(uiConf.confVars, { pluginName: BUNDLER_PLUGIN_NAME, version: i.version });
  const plan = {
    player: { id: uiConf.id, name: uiConf.name },
    confVars: {
      pluginKey: BUNDLER_PLUGIN_NAME,
      before: cv.before === undefined ? null : cv.before,
      after: cv.after,
      changed: cv.changed,
      newConfVarsJson: JSON.stringify(cv.confVars)
    }
  };
  let newConfigJson;
  if (i.setConfig) {
    const cfg = mergeConfig(uiConf.config, { clientId: i.clientId, region: i.region, configKey: CONFIG_PLUGIN_KEY });
    newConfigJson = JSON.stringify(cfg.config);
    plan.config = {
      pluginKey: CONFIG_PLUGIN_KEY,
      before: cfg.before === undefined ? null : cfg.before,
      after: cfg.after
    };
  }
  plan._apply = { newConfVarsJson: JSON.stringify(cv.confVars), newConfigJson };
  return plan;
}

app.post('/api/preview', async (req, res) => {
  const i = pickInputs(req.body);
  const errors = validate(i);
  if (errors.length) return res.status(400).json({ ok: false, errors });
  try {
    const ks = await startSession(i.serviceUrl, i.partnerId, i.adminSecret);
    const uiConf = await getUiConf(i.serviceUrl, ks, i.uiConfId);
    const plan = computePlan(uiConf, i);
    delete plan._apply; // don't leak apply payload to preview response
    res.json({
      ok: true,
      mode: i.mode,
      current: {
        id: uiConf.id,
        name: uiConf.name,
        confVars: uiConf.confVars || '',
        config: uiConf.config || ''
      },
      plan
    });
  } catch (e) {
    res.status(500).json({ ok: false, errors: [e.message] });
  }
});

app.post('/api/apply', async (req, res) => {
  const i = pickInputs(req.body);
  const errors = validate(i);
  if (errors.length) return res.status(400).json({ ok: false, errors });
  try {
    const ks = await startSession(i.serviceUrl, i.partnerId, i.adminSecret);

    // Optionally clone into a new dedicated player first.
    let targetId = i.uiConfId;
    let cloned = null;
    if (i.mode === 'clone') {
      const clone = await cloneUiConf(i.serviceUrl, ks, i.uiConfId);
      targetId = clone.id;
      cloned = { id: clone.id, name: clone.name };
    }

    const uiConf = await getUiConf(i.serviceUrl, ks, targetId);
    const plan = computePlan(uiConf, i);

    const updatePayload = { confVars: plan._apply.newConfVarsJson };
    if (i.setConfig) updatePayload.config = plan._apply.newConfigJson;

    await updateUiConf(i.serviceUrl, ks, targetId, updatePayload);

    // Verify by re-fetching.
    const after = await getUiConf(i.serviceUrl, ks, targetId);
    const verify = computePlan(after, i);
    const versionsOk = !verify.confVars.changed; // already present == success

    res.json({
      ok: true,
      cloned,
      targetId,
      applied: {
        confVarsPluginKey: BUNDLER_PLUGIN_NAME,
        version: i.version,
        setConfig: i.setConfig,
        configPluginKey: i.setConfig ? CONFIG_PLUGIN_KEY : null
      },
      verified: {
        versionsPresent: versionsOk,
        confVars: after.confVars || '',
        config: after.config || ''
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, errors: [e.message] });
  }
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Annoto × Kaltura configurator running at http://${HOST}:${PORT}`);
});
