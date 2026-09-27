const fs = require('node:fs');

function createLocationPermissions(file) {
  let choices;
  try { choices = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { choices = {}; }
  if (!choices || typeof choices !== 'object' || Array.isArray(choices)) choices = {};
  const key = (config, role) => JSON.stringify([config.baseURL, config.backendOrigin, role]);
  function save(next) {
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
    choices = next;
  }
  return {
    get(config, role) {
      const value = choices[key(config, role)];
      return typeof value === 'boolean' ? value : undefined;
    },
    set(config, role, allowed) {
      if (typeof allowed !== 'boolean') throw new Error('Invalid permission choice');
      save({ ...choices, [key(config, role)]: allowed });
    },
    clear(config, role) {
      const next = { ...choices };
      delete next[key(config, role)];
      save(next);
    },
  };
}

module.exports = { createLocationPermissions };
