import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';

const packageJson = require('./package.json');

const config = {
  input: 'src/index.ts',
  external: Object.keys(packageJson.dependencies),
  output: [
    {
      file: packageJson.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    {
      file: packageJson.module,
      format: 'esm',
      sourcemap: true,
    },
  ],
  plugins: [
    resolve(),
    commonjs({
      requireReturnsDefault: "auto",
    }),
    typescript({ useTsconfigDeclarationDir: true }),
  ],
};
export default config;
