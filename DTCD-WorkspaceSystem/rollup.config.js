import styles from 'rollup-plugin-styles';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';

const watch = Boolean(process.env.ROLLUP_WATCH);

const pluginName = 'WorkspaceSystem';

const fileDest = watch
  ? `./../../DTCD/server/plugins/DTCD-${pluginName}/${pluginName}.js`
  : `./build/${pluginName}.js`;

const plugins = [
  resolve(),
  commonjs(),
  babel({ babelHelpers: 'bundled' }),
  styles({ mode: 'inject' }),
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
