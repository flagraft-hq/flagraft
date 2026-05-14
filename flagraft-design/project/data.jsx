/* global React */
const { useState, useMemo } = React;

// ------------- Mock data -------------
const PROJECTS = [
  { id: 'p_001', name: 'Checkout Web', slug: 'checkout-web', flagCount: 24 },
  { id: 'p_002', name: 'Mobile API', slug: 'mobile-api', flagCount: 14 },
  { id: 'p_003', name: 'Internal Tools', slug: 'internal-tools', flagCount: 7 },
];

const ENVS = [
  { id: 'e_dev', slug: 'development', name: 'Development', color: 'teal', protected: false },
  { id: 'e_stg', slug: 'staging', name: 'Staging', color: 'amber', protected: false },
  { id: 'e_prd', slug: 'production', name: 'Production', color: 'red', protected: true },
];

const TAGS = ['checkout', 'experiment', 'kill-switch', 'infra', 'beta', 'payments', 'mobile', 'a11y'];

const FLAGS = [
  {
    key: 'checkout.new-cart',
    name: 'New cart experience',
    desc: 'Two-column cart with sticky summary and inline edit.',
    tags: ['checkout', 'experiment'],
    created: '2026-04-02',
    updated: '2026-05-11 09:14',
    state: { development: { on: true, overrides: 2 }, staging: { on: true, overrides: 1 }, production: { on: false, overrides: 0 } },
    author: 'k_a91c',
  },
  {
    key: 'checkout.apple-pay',
    name: 'Apple Pay button',
    desc: 'Render Apple Pay sheet on supported devices.',
    tags: ['checkout', 'payments'],
    created: '2026-03-18',
    updated: '2026-05-09 17:02',
    state: { development: { on: true, overrides: 0 }, staging: { on: true, overrides: 0 }, production: { on: true, overrides: 3 } },
    author: 'k_a91c',
  },
  {
    key: 'killswitch.fraud-screen',
    name: 'Fraud screen kill switch',
    desc: 'Disable the fraud screening service if vendor goes down.',
    tags: ['kill-switch', 'infra'],
    created: '2025-11-04',
    updated: '2026-05-12 08:41',
    state: { development: { on: false, overrides: 0 }, staging: { on: false, overrides: 0 }, production: { on: false, overrides: 0 } },
    author: 'k_root',
  },
  {
    key: 'pricing.regional-tax-v2',
    name: 'Regional tax v2',
    desc: 'New EU + UK tax calculation pipeline.',
    tags: ['payments', 'beta'],
    created: '2026-02-12',
    updated: '2026-05-08 12:30',
    state: { development: { on: true, overrides: 4 }, staging: { on: true, overrides: 2 }, production: { on: false, overrides: 0 } },
    author: 'k_2f10',
  },
  {
    key: 'auth.passkeys',
    name: 'Passkeys sign-in',
    desc: 'WebAuthn-based passwordless login.',
    tags: ['beta', 'mobile'],
    created: '2026-01-22',
    updated: '2026-05-04 11:22',
    state: { development: { on: true, overrides: 0 }, staging: { on: false, overrides: 0 }, production: { on: false, overrides: 0 } },
    author: 'k_a91c',
  },
  {
    key: 'profile.dark-mode',
    name: 'User-controlled dark mode',
    desc: 'Adds theme toggle to profile settings.',
    tags: ['a11y'],
    created: '2025-12-09',
    updated: '2026-04-30 09:11',
    state: { development: { on: true, overrides: 0 }, staging: { on: true, overrides: 0 }, production: { on: true, overrides: 0 } },
    author: 'k_2f10',
  },
  {
    key: 'mobile.offline-cart',
    name: 'Offline cart',
    desc: 'Persist cart locally when device is offline.',
    tags: ['mobile', 'experiment'],
    created: '2026-03-30',
    updated: '2026-05-02 16:42',
    state: { development: { on: true, overrides: 1 }, staging: { on: false, overrides: 0 }, production: { on: false, overrides: 0 } },
    author: 'k_a91c',
  },
  {
    key: 'infra.read-replicas',
    name: 'Read replicas',
    desc: 'Route reads to the new read-replica pool.',
    tags: ['infra'],
    created: '2025-10-01',
    updated: '2026-04-28 21:09',
    state: { development: { on: true, overrides: 0 }, staging: { on: true, overrides: 0 }, production: { on: true, overrides: 1 } },
    author: 'k_root',
  },
];

const OVERRIDES = [
  { id: 'ov_01', flag: 'checkout.new-cart', env: 'production', key: 'cohort', op: 'equals', val: 'beta', result: true, note: 'Beta cohort, week 2', created: '2026-05-10' },
  { id: 'ov_02', flag: 'checkout.new-cart', env: 'production', key: 'userId', op: 'in', val: 'usr_4291, usr_8810, usr_1132', result: true, note: 'Friendlies', created: '2026-05-09' },
  { id: 'ov_03', flag: 'checkout.new-cart', env: 'production', key: 'region', op: 'equals', val: 'eu', result: false, note: 'EU rollout paused', created: '2026-05-04' },
  { id: 'ov_04', flag: 'checkout.apple-pay', env: 'production', key: 'plan', op: 'equals', val: 'enterprise', result: true, note: '', created: '2026-04-22' },
];

const API_KEYS = [
  { id: 'k_root', label: 'root', scope: 'root', prefix: 'ff_rt_91a2', created: '2025-09-01', lastUsed: '2026-05-12 08:32', createdBy: 'cli' },
  { id: 'k_a91c', label: 'Checkout admin', scope: 'admin', project: 'Checkout Web', prefix: 'ff_ad_a91c', created: '2026-01-15', lastUsed: '2026-05-12 06:14', createdBy: 'k_root' },
  { id: 'k_2f10', label: 'On-call admin', scope: 'admin', project: 'Checkout Web', prefix: 'ff_ad_2f10', created: '2026-03-02', lastUsed: '2026-05-11 22:50', createdBy: 'k_root' },
  { id: 'k_c441', label: 'Web client (prod)', scope: 'client', project: 'Checkout Web', env: 'production', prefix: 'ff_cl_c441', created: '2026-02-20', lastUsed: '2026-05-12 09:01', createdBy: 'k_a91c' },
  { id: 'k_c5e2', label: 'Web client (staging)', scope: 'client', project: 'Checkout Web', env: 'staging', prefix: 'ff_cl_c5e2', created: '2026-02-20', lastUsed: '2026-05-12 08:55', createdBy: 'k_a91c' },
];

const AUDIT = [
  { when: '08:41', day: 'Today, May 12', actor: 'k_root', type: 'enable', desc: 'Enabled `infra.read-replicas` in production', env: 'production' },
  { when: '08:32', day: 'Today, May 12', actor: 'k_a91c', type: 'override', desc: 'Added override `cohort=beta` for `checkout.new-cart` in production', env: 'production' },
  { when: '06:14', day: 'Today, May 12', actor: 'k_a91c', type: 'disable', desc: 'Disabled `checkout.new-cart` in production', env: 'production' },
  { when: '22:50', day: 'Yesterday, May 11', actor: 'k_2f10', type: 'enable', desc: 'Enabled `pricing.regional-tax-v2` in staging', env: 'staging' },
  { when: '17:02', day: 'Yesterday, May 11', actor: 'k_a91c', type: 'create', desc: 'Created flag `checkout.apple-pay`', env: '' },
  { when: '12:30', day: 'Yesterday, May 11', actor: 'k_a91c', type: 'keyIssued', desc: 'Issued client key `ff_cl_c441` for production', env: 'production' },
  { when: '09:11', day: 'Friday, May 8', actor: 'k_2f10', type: 'override', desc: 'Removed override `userId=usr_99` from `pricing.regional-tax-v2`', env: 'staging' },
  { when: '08:00', day: 'Friday, May 8', actor: 'k_root', type: 'envCreated', desc: 'Created environment `preview`', env: '' },
];

const CONTEXT_FIELDS = [
  { key: 'userId',    type: 'string',  source: 'sdk',    required: true,  example: 'usr_4291',          desc: 'Stable identifier for the end user. Used for sticky bucketing.', usedIn: 18 },
  { key: 'email',     type: 'string',  source: 'sdk',    required: false, example: 'aida@kocharsoft.com', desc: 'Used by allow-list rules and internal-user targeting.', usedIn: 4 },
  { key: 'cohort',    type: 'enum',    source: 'sdk',    required: false, example: 'beta',              desc: 'Experiment cohort assigned at signup.', enumValues: ['control', 'beta', 'alpha', 'internal'], usedIn: 7 },
  { key: 'plan',      type: 'enum',    source: 'server', required: false, example: 'enterprise',        desc: 'Billing plan. Looked up server-side from the customer record.', enumValues: ['free', 'pro', 'team', 'enterprise'], usedIn: 9 },
  { key: 'country',   type: 'string',  source: 'server', required: false, example: 'DE',                desc: 'ISO 3166-1 alpha-2. Derived from request IP.', usedIn: 6 },
  { key: 'region',    type: 'enum',    source: 'server', required: false, example: 'eu',                desc: 'Coarse region used for rollout pausing.', enumValues: ['us', 'eu', 'apac', 'latam'], usedIn: 5 },
  { key: 'appVersion',type: 'version', source: 'sdk',    required: false, example: '4.18.2',            desc: 'Semver of the calling client. Supports range comparisons.', usedIn: 3 },
  { key: 'platform',  type: 'enum',    source: 'sdk',    required: false, example: 'web',               desc: 'Where the SDK is running.', enumValues: ['web', 'ios', 'android', 'server'], usedIn: 4 },
  { key: 'isInternal',type: 'boolean', source: 'computed', required: false, example: 'true',            desc: 'Derived: email ends with @kocharsoft.com.', usedIn: 6 },
];

Object.assign(window, { PROJECTS, ENVS, TAGS, FLAGS, OVERRIDES, API_KEYS, AUDIT, CONTEXT_FIELDS });
