# @flagraft/sdk

TypeScript SDK for [Flagraft](../../README.md) feature flags. First-party client with a built-in TTL cache and safe fallback semantics.

## Install

```bash
pnpm add @flagraft/sdk
```

## Quickstart

```ts
import { FlagraftClient } from '@flagraft/sdk'

const flags = new FlagraftClient({
  baseUrl: 'https://flags.example.com',
  apiKey: process.env.FLAGRAFT_KEY!,
  ttl: 30,
})

if (await flags.isEnabled('checkout-v2', { userId: 'u_42' })) {
  // render the new checkout
}
```

## API

### `new FlagraftClient(options)`

| Option  | Type     | Default          | Description                                           |
| ------- | -------- | ---------------- | ----------------------------------------------------- |
| baseUrl | string   | (required)       | Base URL of the Flagraft server.                      |
| apiKey  | string   | (required)       | A client API key issued by an admin.                  |
| ttl     | number   | 30               | Cache TTL in seconds. Set to 0 to disable caching.    |
| fetch   | function | globalThis.fetch | Optional fetch override (testing, custom transports). |

### `isEnabled(flagKey, context?)`

Returns `Promise<boolean>`. Returns `false` on network failure or when the flag is unknown (404). Throws `FlagraftError` for other 4xx responses.

### `getFeatures(context?)`

Returns `Promise<Record<string, boolean>>`. Useful for hydrating a UI in one call.

### `getAllFeatures(context?)`

Returns `Promise<Array<{ name: string; enabled: boolean }>>`. The raw response shape.

## Error model

Network failures resolve to a safe `false` so flag checks never throw at the call site. HTTP 4xx other than 404 surface as `FlagraftError` with `statusCode` and `code` properties matching the server error envelope.

## Caching

Single-flag and bulk responses are cached separately. The cache key includes a stable JSON serialization of the context object so callers do not have to worry about property ordering.
