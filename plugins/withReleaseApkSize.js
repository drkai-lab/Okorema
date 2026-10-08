const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

function setGradleProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === "property" && item.key === key);
  if (existing) {
    existing.value = value;
    return;
  }
  properties.push({ type: "property", key, value });
}

/** Smaller sideload APK: compress dex, and skip image codecs this app does not ship. */
function withReleaseApkSize(config) {
  config = withGradleProperties(config, (config) => {
    setGradleProperty(config.modResults, "expo.gif.enabled", "false");
    setGradleProperty(config.modResults, "expo.webp.enabled", "false");
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      return config;
    }
    const needle = "packagingOptions {\n        jniLibs {";
    const insert = "packagingOptions {\n        dex {\n            useLegacyPackaging = true\n        }\n        jniLibs {";
    if (!config.modResults.contents.includes("dex {\n            useLegacyPackaging = true")) {
      if (!config.modResults.contents.includes(needle)) {
        throw new Error("app/build.gradle is missing the packagingOptions.jniLibs block");
      }
      config.modResults.contents = config.modResults.contents.replace(needle, insert);
    }
    return config;
  });

  return config;
}

module.exports = withReleaseApkSize;
