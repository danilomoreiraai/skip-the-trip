# Experimental beta: accessibility and authorization review

This record supports [#29](https://github.com/danilomoreiraai/skip-the-trip/issues/29) and [#30](https://github.com/danilomoreiraai/skip-the-trip/issues/30), under the voluntary portfolio-beta scope approved in [#45](https://github.com/danilomoreiraai/skip-the-trip/issues/45). It replaces the unmerged supervised-session protocol from PR #40. No participant roster, device matrix, completion rates or mandatory screen-reader campaign is required. Untested coverage remains unverified, never passed.

## Revision and method

Review date: **19 October 2026**, Europe/Dublin. Observed production revision: `dcb3f3921098f8ed106ec9763e376940fd71b02c`. Public web/API revision, liveness and readiness checks passed. The production release's [Quality run](https://github.com/danilomoreiraai/skip-the-trip/actions/runs/39272886407) passed, including 33 server unit tests and seven PostgreSQL integration cases.

PR #40 updates the preparatory work against that release, updates this record and adds tests only. It does not change the application's runtime code, location configuration, privacy behavior or database schema. Its own Quality checks verify the final test/documentation revision; do not describe that revision as deployed unless it is separately published.

The local UI suite passed **32/32** Chromium cases across desktop and mobile viewport/touch emulation. The new cases exercise 320 CSS px reflow and permission-denied, position-unavailable and timeout recovery. Reports, authorization APIs and browser geolocation are synthetic in these tests; a mocked success is not a real GPS or production-vote result.

Local location-domain tests passed **12/12**. The local route-test runner did not complete and was stopped; no local route-test pass is claimed. Use the final PR's Quality CI for the cookie-recovery regression and complete route/database results.

## Accessibility and clarity (#29)

| Area | Method and observed result |
| --- | --- |
| Semantic names and state | Live accessibility tree exposes named building/floor/category groups, selected option states, explicitly named Yes/No controls and the location dialog. Disabled buildings include Available soon. Native buttons use pressed-state semantics. This is browser-tree inspection, not a screen-reader observation. |
| Keyboard and focus | Live Tab order starts at the home link then HH5. The home link has a visible 3 px solid outline. On opening the location dialog, focus enters Confirm location; Shift+Tab wraps to Cancel, Tab returns, and Escape returns focus to the initiating contribution control. Automated consent/location containment and reduced-motion cases pass. |
| Reflow and targets | Live 320/375 CSS px review and local 320 px regression show no horizontal document overflow during lookup. The live 320 px Yes/No targets measured 95 × 49 CSS px. The automated regression checks enabled button dimensions and explicit unknown-state copy. |
| Contrast | Ratios calculated from published opaque foreground/background colors: ink/surface **13.89:1**, muted/surface **5.44:1**, ink/positive **4.89:1**, ink/negative **4.85:1**, white/accent **4.75:1**. This checks these pairs, not every composited, disabled or image color. |
| Non-color meaning | Yes/No text, numeric counts and No recent information distinguish the states without relying on green/red. Selection has pressed-state semantics and an inset visual treatment. |
| Loading/error/retry | Named loading states exist. UI tests cover HTTP 503 and Try again, location rejection visible above the modal, fallback after unavailable high accuracy, and actionable location failure text. |
| Comprehension | Lookup works without location permission. The dialog explains coordinate disposal and four-hour verification. Unknown status says No recent information and Be the first to report; it does not claim availability. Cooldown/freshness and contribution isolation pass synthetic UI cases. These are copy/behavior checks, not observed participant comprehension. |
| Privacy/support | Live privacy/support links and consent controls were checked in #28 and #1 on the same release. Email delivery was not retested. |

The earlier high-severity keyboard-focus defect [#39](https://github.com/danilomoreiraai/skip-the-trip/issues/39) was fixed by PR #41 and retested on the release above. No new P0/P1 blocker was observed in this bounded review.

## Authorization and recovery (#30)

| Scenario | Evidence and boundary |
| --- | --- |
| Public lookup / missing authorization | Live API-backed lookup succeeds without a location prompt. An unauthorised contribution attempt returns HTTP 403 and opens the confirmation dialog. No successful vote or location confirmation was submitted during this review. |
| Permission denied | Synthetic browser code 1 shows the location-access explanation, leaves confirmation/cancel usable and preserves lookup after cancellation. No coordinate-verification request is sent. |
| Position unavailable / timeout | Synthetic codes 2/3 exhaust the high/low-accuracy attempts, show Try again guidance and allow cancellation back to lookup without a verification request or successful vote. A separate case verifies that one unavailable high-accuracy attempt can fall back successfully. |
| Inside / inclusive boundary / outside | The 12 passing domain tests cover inside, inclusive boundary, outside, insufficient accuracy, invalid input, fixed four-hour lifetime and exact expiry. These are mathematical/synthetic server cases. |
| Cookie and authorization recovery | Route tests cover authorized/unauthorized contributions. The added cookie regression checks that a retained authorization is inaccessible without the cookie and accessible with the original cookie. PostgreSQL CI tests check reuse without extending expiry, replacement after expiry and deletion. This is not cross-browser cookie-policy evidence. |
| Reload, retry and freshness | UI mocks cover reload/persistence, per-bathroom cooldown, isolation, expiry and retry. Same-release live checks in #28 cover same-tab reload and simulated connection loss/recovery. Real OS/network transitions remain unverified. |
| Deployment configuration | #48 records the verified production HH5 configuration, 500 m radius and 100 m accuracy ceiling, with synthetic accepted/rejected API evidence. The current release changes analytics only after that configuration review. No location override or authorization lifetime changed in this work. |
| Privacy | No production coordinates were requested or published here. Application authorization rows store identity, location ID and verification/expiry times; coordinate rejection/minimization and privacy-safe telemetry remain covered by existing CI tests. No telemetry was added. |

## Explicitly unverified

- Physical iOS/Android, Safari/WebKit, VoiceOver/TalkBack, platform larger-text settings, actual browser 200%/400% zoom, orientation on physical devices, private browsing and home-screen/standalone mode.
- Browser zoom shortcuts in the in-app browser did not change measured viewport/scale; no zoom pass is inferred from that attempt. A 320 px reflow result does not establish actual zoom or platform text scaling.
- Real GPS accuracy, OS permission/settings recovery, real network transitions, browser termination/reopen behavior and participant task outcomes.
- Complete WCAG conformance, every contrast combination, and real screen-reader announcement frequency.

A short standalone Privacy link has a previously observed height near 24 CSS px; comfortable physical activation and spacing exceptions are not certified by button-size tests. Record a separate issue if a concrete barrier is demonstrated.

## Release gate and follow-up

Any observed P0/P1, privacy exposure, data loss/duplication or other stop condition pauses sharing under [#35](https://github.com/danilomoreiraai/skip-the-trip/issues/35). File actionable defects separately with severity, owner, affected revision and retest result. Do not infer success from silence.

On 20 October the owner confirmed that the link has been shared; the exact distribution date/time and revision at sharing remain unconfirmed. Early observations are recorded in [#33](https://github.com/danilomoreiraai/skip-the-trip/issues/33); the planned first review remains 27 October 2026. The owner has scoped this to a temporary experiment for a selected group agreeing to participate, with later deactivation intended but no shutdown date defined. Independent legal review is no longer an acceptance requirement. [#22](https://github.com/danilomoreiraai/skip-the-trip/issues/22) retains technical privacy/provider-evidence follow-up; existing privacy, consent, retention and security controls remain in scope. This scope update adds no physical-device or assistive-technology test evidence.
