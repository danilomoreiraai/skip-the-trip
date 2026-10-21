# Version 2.0 preview

Issue #75. Branch: `codex/v2.0-tests`, based on the preserved next UI.
Public entry: https://skipthetrip.info/teste2_0/ .

The EasyPanel Compose service `personal_projects/skip-the-trip-v2` uses
`compose.v2-test.yml` from this branch, with a dedicated `V2_POSTGRES_PASSWORD`
and the exact deployed commit as `APP_REVISION`. There is no automatic deploy:
pushes update the branch; a reviewed revision is deployed explicitly.

Configure a domain route with host `skipthetrip.info`, path `/teste2_0`, destination
Compose service `web`, HTTP port 80, destination path `/`. The proxy removes the
prefix; Vite's base and BrowserRouter keep navigation, lazy chunks, icons and
API requests under `/teste2_0/`. Do not change the existing root domain route.

The preview has its own PostgreSQL volume and database, no published database
or API ports, a distinct anonymous identity cookie, and browser preferences
namespaced by base path. Analytics and remote telemetry exporters are unset.
Daily retention removes records older than 30 days. Public test data can be
read by anyone with the URL; this is a separate testing environment, not an
access-controlled private beta.

Manual device selection and the existing HH5 geolocation/cooldown rules still
apply. Mobile consultation works remotely; voting still requires location
confirmation near HH5. Browser simulations do not establish physical-device
GPS behavior.

Verify a deployed SHA:

```sh
APP_REVISION=<full-sha> VERIFY_BASE_URL=https://skipthetrip.info/teste2_0 node scripts/verify-release.mjs
```

Before and after each preview deployment, verify the root still serves its
pinned pre-HH5 baseline (`63ccc44783ae4ebc77a736ef2a0c1ea564a8fafb`). Never merge
this branch into the current beta or change the beta service source to it.
Rollback a preview by setting its source ref and `APP_REVISION` to the previous
preview SHA, then deploying only `skip-the-trip-v2`. The root beta is independent.
