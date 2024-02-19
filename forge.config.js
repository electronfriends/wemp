module.exports = {
  packagerConfig: {
    asar: true,
    icon: 'icons/wemp.ico',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        iconUrl: 'https://raw.githubusercontent.com/electronfriends/wemp/main/icons/wemp.ico',
        setupIcon: 'icons/wemp.ico',
      },
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
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main.js',
            config: 'vite.config.mjs',
          },
        ],
        renderer: [],
      },
    },
  ],
};
