# Render test environment

This branch defines a zero-cost, disposable test environment:

- `cap-portal-test`: Render Static Site
- `cap-portal-api-test`: free Render Python Web Service
- SQLite database on the API service's ephemeral filesystem

## Expected behavior

The test database is intentionally disposable. Its contents reset whenever the
free API sleeps, restarts, or redeploys. This isolates all test proposals,
comments, roles, and users from production.

The API uses `ENVIRONMENT=production` so development-only unauthenticated
endpoints remain disabled. Wallet authentication works normally. The first
authenticated user can claim the initial test administrator/editor roles after
each database reset.

Do not point this branch at the production `DATABASE_URL`, and do not add the
test API to a keep-alive workflow. A sleeping free service preserves the shared
Render workspace's monthly free instance hours.

## Create the services

1. Push the `test` branch to GitHub.
2. In Render, choose **New > Blueprint**.
3. Select this repository and the `test` branch.
4. Set **Blueprint Path** to `render-test.yaml`.
5. Review the two proposed services and apply the Blueprint.
6. Confirm both expected URLs are available:
   - `https://cap-portal-test.onrender.com`
   - `https://cap-portal-api-test.onrender.com/health`

If either service name is already taken, rename both services in
`render-test.yaml`, update the production-host value in
`frontend/js/config.js`, commit, and sync the Blueprint again.

## Verify isolation

1. Open the test frontend.
2. Connect a wallet and create a clearly labeled test proposal.
3. Confirm the proposal appears only on the test site.
4. Open the production site and confirm it is absent.

