import styles from 'rollup-plugin-styles';

const watch = Boolean(process.env.ROLLUP_WATCH);

const pluginName = 'WorkspaceSystem';

const fileDest = watch ? `./../../DTCD/server/plugins/${pluginName}.js` : `./build/${pluginName}.js`;

const plugins = [styles({mode: 'inject'})];

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
