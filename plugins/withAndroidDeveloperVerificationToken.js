const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const FILE_NAME = 'adi-registration.properties';
const ENV_NAME = 'ANDROID_DEVELOPER_VERIFICATION_SNIPPET';

module.exports = function withAndroidDeveloperVerificationToken(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const assetsDirectory = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets',
      );
      const targetPath = path.join(assetsDirectory, FILE_NAME);
      const snippet = String(process.env[ENV_NAME] || '').trim();

      if (!snippet) {
        if (fs.existsSync(targetPath)) fs.rmSync(targetPath);
        return modConfig;
      }

      fs.mkdirSync(assetsDirectory, { recursive: true });
      fs.writeFileSync(targetPath, `${snippet}\n`, { encoding: 'utf8', mode: 0o600 });
      return modConfig;
    },
  ]);
};
