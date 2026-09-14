# @flagraft/mcp

An [MCP](https://modelcontextprotocol.io) server for [Flagraft](https://github.com/flagraft-hq/flagraft), so a coding agent -- Claude Code, Cursor, Codex, or anything else that speaks MCP -- can read and toggle your feature flags while it writes the code behind them.

"Put this behind a flag" stops meaning "stop writing code, open the admin UI, come back".

```
> Add the new checkout flow behind a flag, off everywhere.

  ● list_projects
  ● create_flag (key: new-checkout-flow)
  ● Wrote src/checkout/index.ts
```

It runs on your machine and talks to your own Flagraft server. Nothing goes anywhere else.

---

## Install

No install needed -- point your agent at it with `npx`.

**Claude Code:**

```sh
claude mcp add flagraft \
  --env FLAGRAFT_URL=http://localhost:3000 \
  --env FLAGRAFT_API_KEY=ff_your_admin_key \
  -- npx -y @flagraft/mcp
```

**Anything reading `mcp.json`** (Cursor, VS Code, Codex, Windsurf):

```json
{
  "mcpServers": {
    "flagraft": {
      "command": "npx",
      "args": ["-y", "@flagraft/mcp"],
      "env": {
        "FLAGRAFT_URL": "http://localhost:3000",
        "FLAGRAFT_API_KEY": "ff_your_admin_key"
      }
    }
  }
}
```

## Configuration

| Variable           | Default                 | Description                                                                   |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------- |
| `FLAGRAFT_API_KEY` | --                      | Required. A root or project admin key. Client keys cannot read the admin API. |
| `FLAGRAFT_URL`     | `http://localhost:3000` | Origin of your Flagraft server.                                               |

A project admin key is the right choice for day-to-day work: it is scoped to one project, so the agent cannot reach anything else. Create one with `POST /api/v1/admin/projects/:id/keys`, or from the API keys screen in the admin UI.

## Tools

| Tool                | What it does                                                                |
| ------------------- | --------------------------------------------------------------------------- |
| `list_projects`     | Every project the key can see, with ids and slugs                           |
| `list_environments` | A project's environments -- the slugs you toggle against                    |
| `list_flags`        | Flags in a project with their per-environment state; searchable, filterable |
| `get_flag`          | One flag by key, including its state in every environment                   |
| `create_flag`       | Create a flag. Starts off everywhere.                                       |
| `set_flag_state`    | Turn a flag on or off in one environment                                    |
| `list_strategies`   | The ordered targeting strategies for a flag in an environment               |

**There is no delete tool, and strategies are read-only.** An agent that can drop a project or silently rewrite who a rollout targets is a worse trade than a human opening the admin UI for the rare destructive change. If you disagree, the server is about 200 lines -- add it.

On a [protected environment](../../README.md) that requires two-admin approval, `set_flag_state` records the change as pending and answers `applied: false`. The tool description tells the agent to report that rather than claim the flag is on.

## Local development

```sh
pnpm --filter @flagraft/mcp build
pnpm --filter @flagraft/mcp test
```

To run it against a local server without publishing:

```json
{
  "mcpServers": {
    "flagraft": {
      "command": "node",
      "args": ["/absolute/path/to/flagraft/packages/mcp/dist/index.js"],
      "env": { "FLAGRAFT_API_KEY": "ff_your_admin_key" }
    }
  }
}
```

## License

MIT
