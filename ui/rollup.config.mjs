import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import replace from '@rollup/plugin-replace';

// Main library, ESM. Two entries: the React components (index.esm) and the
// framework-agnostic engine (engine/index). The engine is its own chunk in
// dist/engine/, next to nam-worklet.js and nam-engine.wasm, so its literal
// `new URL('./nam-worklet.js', import.meta.url)` asset references resolve
// correctly and stay statically analyzable by consumer bundlers.
const libraryEsm = {
  input: {
    'index.esm': 'src/index.ts',
    'engine/index': 'src/engine/index.ts',
  },
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].js',
    chunkFileNames: 'chunks/[name]-[hash].js',
    sourcemap: true,
  },
  external: ['react', 'react-dom'],
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'production'
      ),
    }),
    resolve(),
    commonjs(),
    postcss({
      plugins: [tailwindcss, autoprefixer],
      extract: 'styles.css',
    }),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
    }),
  ],
};

// CJS build (single file). The engine's default asset resolution relies on
// import.meta.url and is intended for the ESM build; CJS consumers should
// pass assetBaseUrl.
const libraryCjs = {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
    sourcemap: true,
  },
  external: ['react', 'react-dom'],
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'production'
      ),
    }),
    resolve(),
    commonjs(),
    postcss({
      plugins: [tailwindcss, autoprefixer],
      extract: 'styles.css',
    }),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationDir: undefined,
    }),
  ],
};

// AudioWorklet processor bundle. Must be fully self-contained (the Emscripten
// glue is inlined, no import statements in the output) because worklet module
// scripts cannot reliably resolve relative imports once bundlers copy them to
// hashed asset URLs, and Firefox does not support static imports in worklets.
const worklet = {
  input: 'src/engine/nam-worklet.ts',
  output: {
    file: 'dist/engine/nam-worklet.js',
    format: 'es',
    sourcemap: false,
    inlineDynamicImports: true,
  },
  // Node-only dynamic import inside the Emscripten glue; never runs in the
  // browser.
  external: [/^node:/],
  plugins: [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationDir: undefined,
      outDir: undefined,
      sourceMap: false,
    }),
  ],
};

export default [libraryEsm, libraryCjs, worklet];
