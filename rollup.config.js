import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import typescript from 'rollup-plugin-typescript2';
const extensions = [".js", ".ts"];

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'esm/vue-class-composition.js',
      format: 'esm',
      name: 'vueClassComposition',
      globals: {
        'vue': 'Vue'
      }
    },
    {
      file: 'lib/vue-class-composition.js',
      format: 'cjs',
      name: 'vueClassComposition',
      globals: {
        'vue': 'Vue'
      }
    },
    {
      file: 'umd/vue-class-composition.js',
      format: 'umd',
      name: 'vueClassComposition',
      globals: {
        'vue': 'Vue'
      }
    }
  ],
  plugins: [
    json(),
    typescript(),
    nodeResolve({
      extensions
    }),
    commonjs({
      extensions,
      ignoreGlobal: false
    })
  ],
  external: ['vue'],
  watch: {
    include: 'src/**',
    exclude: 'node_modules/**'
  }
}