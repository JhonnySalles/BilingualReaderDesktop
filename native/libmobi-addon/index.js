'use strict';
/**
 * Loads the compiled native addon when present.
 * Without a successful build, LibmobiAdapter stays unavailable.
 */
try {
  module.exports = require('./build/Release/libmobi_addon.node');
} catch (e1) {
  try {
    module.exports = require('./build/Debug/libmobi_addon.node');
  } catch (e2) {
    module.exports = null;
  }
}
