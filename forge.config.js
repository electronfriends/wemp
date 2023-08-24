module.exports = {
  packagerConfig: {
    appBundleId: 'com.electronfriends.wemp',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'electronfriends',
          name: 'wemp',
        },
        prerelease: true,
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main.js',
            config: 'vite.config.mjs',
          },
        ],
        renderer: [],
      },
    },
  ],
};
