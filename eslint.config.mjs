import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // next-env.d.ts lo genera Next.js en cada build; no se versiona ni se lintea.
    ignores: ['.next/**', 'node_modules/**', 'prisma/migrations/**', 'next-env.d.ts'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Scripts de linea de comandos: escriben en consola por definicion.
    files: ['scripts/**/*.{ts,tsx}', 'prisma/seeds/**/*.{ts,tsx}'],
    rules: { 'no-console': 'off' },
  },
  {
    /**
     * La ingesta recorre las tablas por NOMBRE (`p[modelo]`) en vez de por
     * metodo del cliente generado, porque el mismo recorrido sirve para las
     * nueve dimensiones y para que anadir una tabla sea una entrada de
     * configuracion y no codigo nuevo. El tipo generado de Prisma no describe
     * ese acceso, asi que `any` es inevitable ahi.
     *
     * Se relaja SOLO en `scripts/**`. `src/` mantiene la regla activa: alli un
     * `any` si es una falta de tipado real y no una limitacion del acceso.
     */
    files: ['scripts/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
];

export default config;
