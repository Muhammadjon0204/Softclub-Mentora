// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The web app's translation catalogs (keyed by the Russian text) are shared with the app: status
// names, roles and other domain words read the same on the site and on the phone.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../Frontend/src/shared/i18n/catalog')];

module.exports = config;
