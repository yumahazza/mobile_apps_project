// plugins/withFirebaseBom.js
const { withProjectBuildGradle } = require('expo/config-plugins');

module.exports = function withFirebaseBom(config, props = {}) {
  const bom = (typeof props === 'string' ? props : props?.bom) || '34.19.0';
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === 'groovy') {
      const targetString = 'allprojects {';
      const snippet = `
project.ext {
  set('react-native', [versions: [firebase: [bom: '${bom}']]])
}

allprojects {`;
      if (!modConfig.modResults.contents.includes('firebase: [bom:')) {
        if (modConfig.modResults.contents.includes(targetString)) {
          modConfig.modResults.contents = modConfig.modResults.contents.replace(targetString, snippet);
        } else {
          modConfig.modResults.contents += `\nproject.ext {\n  set('react-native', [versions: [firebase: [bom: '${bom}']]])\n}\n`;
        }
      }
    }
    return modConfig;
  });
};
