# Security policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub:
[Report a vulnerability](https://github.com/flagraft-hq/flagraft/security/advisories/new).
That opens a draft advisory only the maintainers can see.

Useful things to include, as far as you have them: what an attacker can do, the
steps to reproduce, the version or commit, and whether it needs an authenticated
account or an API key.

You should get an acknowledgement within a week. If you do not hear anything,
assume the message was missed and open a public issue saying only that you are
waiting on a security response -- no details.

## Supported versions

Flagraft is pre-1.0 and has not had a security audit. Only the latest release
gets fixes; there are no backports to earlier versions.

| Version        | Supported |
| -------------- | --------- |
| Latest release | Yes       |
| Anything older | No        |

## Things that are not vulnerabilities

Flagraft is self-hosted, so some of its security depends on how you run it.
These are documented behaviors rather than bugs:

- **The default admin password.** First boot seeds an admin account with a
  published default password. The server refuses to start in production until
  `DEFAULT_ADMIN_PASSWORD` is changed. Leaving it set in a non-production
  deployment that is nonetheless reachable is a deployment mistake.
- **Client keys are low-privilege, but not public.** A client key is scoped to
  one project and environment and can only evaluate flags. It is still a
  credential: the SDK is server-side, and browser apps are expected to proxy
  evaluation through their own backend rather than ship the key to visitors. A
  client key found in a published frontend bundle is a real report.
- **Swagger UI at `/docs`.** Served outside production, disabled when
  `NODE_ENV=production`.
- **`TRUST_PROXY` left off behind a proxy.** Rate limits then count every caller
  as the proxy. That is a misconfiguration; see the README.

Known limitations we already track, including the gaps in regex constraint
screening and login throttling, are listed in
[docs/ROADMAP.md](docs/ROADMAP.md#known-limitations). Reports that restate those
are welcome but will be closed as known.

## Scope

In scope: the server, the admin UI, the SDK, and the published Docker image.

Out of scope: vulnerabilities in dependencies that have no exploitable path
through Flagraft, and anything requiring an attacker who already has workspace
owner access -- that role can already change everything by design.
