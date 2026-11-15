import { defineConfig } from '@tarojs/cli';

export default defineConfig({
  projectName: 'kaoyan-platform-mvp',
  date: '2026-11-15',
  designWidth: 750,
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'webpack5',
  mini: {
    postcss: {
      pxtransform: { enable: true },
      cssModules: { enable: false },
    },
  },
});
