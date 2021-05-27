import styles from 'rollup-plugin-styles';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

const watch = Boolean(process.env.ROLLUP_WATCH);

const pluginName = 'WorkspaceSystem';

const fileDest = watch
  ? `./../../DTCD/server/plugins/DTCD-${pluginName}/${pluginName}.js`
  : `./build/${pluginName}.js`;

const plugins = [resolve(), commonjs(), styles({ mode: 'inject' })];

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
