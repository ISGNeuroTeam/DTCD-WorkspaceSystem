import styles from 'rollup-plugin-styles';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import html from 'rollup-plugin-html';
import vue from 'rollup-plugin-vue';
import replace from '@rollup/plugin-replace';

import { version } from './package.json';

const watch = Boolean(process.env.ROLLUP_WATCH);

const pluginName = 'WorkspaceSystem';

const fileDest = watch
  ? `./../../DTCD/server/plugins/DTCD-${pluginName}_${version}/${pluginName}.js`
  : `./build/${pluginName}.js`;

const plugins = [
  resolve({
    jsnext: true,
    preferBuiltins: true,
    browser: true,
    dedupe: ['vue'],
    extensions: ['.mjs', '.js', '.json', '.node', '.vue'],
  }),
  babel({ babelHelpers: 'bundled' }),
  commonjs(),
  html({ include: '**/*.html' }),
  vue({
    preprocessStyles: true,
  }),
  styles({ mode: 'inject' }),
  replace({
    preventAssignment: true,
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.VUE_ENV': JSON.stringify('browser'),
  }),
  json(),
];

export default {
  input: `./src/${pluginName}.js`,
  output: {
    file: fileDest,
    format: 'esm',
    sourcemap: false,
  },
  watch: {
    include: ['./*/**'],
  },
  plugins,
};
