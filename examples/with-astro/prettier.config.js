import config from '@williecubed/prettier-config';

export default {
  ...config,
  plugins: ['prettier-plugin-astro'],
  overrides: [{ files: '*.astro', options: { parser: 'astro' } }],
};
