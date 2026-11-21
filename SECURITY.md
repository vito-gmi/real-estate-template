# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub: on this repository's **Security** tab, choose **Report a vulnerability**. Include what you found, how to reproduce it, and the impact you expect. You will get an acknowledgement within a few days, and credit in the fix's release notes if you want it.

## Supported versions

Only the latest commit on `main` receives security fixes. If you run a fork, merge `main` regularly to pick them up.

## Scope

In scope: the code in this repository — the admin console and its authentication, the public site, the upload and storage adapters, the server actions and route handlers, and the deployment configuration (`Dockerfile`, `docker-compose.yml`, `Caddyfile`).

Out of scope: vulnerabilities in a specific deployment's infrastructure or settings (weak secrets, a database exposed by its operator), and issues in third-party dependencies that are already reported upstream.

How the application is hardened — sessions, two-factor authentication, rate limits, the content security policy and data handling — is described in [docs/security.md](docs/security.md).
