# Beta accessibility and task-usability acceptance (#29)

This is the working protocol and evidence register for [issue #29](https://github.com/danilomoreiraai/skip-the-trip/issues/29). Keep the device and participant fields blank until sessions happen. Browser automation is supporting evidence only; it cannot establish VoiceOver, TalkBack, or participant completion rates.

## Before a session

1. Use the release revision and device/network entries from the [real-device matrix (#28)](https://github.com/danilomoreiraai/skip-the-trip/issues/28). Record the public release revision shown by the deployed app. Do not use a local build as production evidence.
2. Explain that status lookup does not need location permission; voting does. Conduct a vote only with an eligible participant at HH5. Follow the separate [location validation (#30)](https://github.com/danilomoreiraai/skip-the-trip/issues/30) for GPS behavior.
3. Obtain consent to observe the task. Use participant codes, never names or contact details in this document. Record the browser mode, assistive technology and settings used.
4. Do not capture coordinates, browser identifiers, cookies, credentials, email messages, or unredacted browser logs. Screenshots are optional and must be checked before sharing.

## Session header (one row per device and participant)

| Session code | Date/time and time zone | Release revision | Device / OS | Browser / version | Browser or home-screen mode | Network | Assistive technology / text size / motion setting | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Accessibility checklist

For each checked path, record **Pass**, **Fail**, **Not tested**, or **N/A**, plus a short observation and linked defect. Repeat the critical paths with VoiceOver on iOS and TalkBack on Android. Test touch exploration and swipe navigation as well as keyboard navigation where a physical keyboard is available.

| Check | Expected observation | Result / session / issue |
| --- | --- | --- |
| First visit and consent | Dialog is announced with a name; focus enters it, stays there, and follows the explicit choice. | Pending; [focus defect #39](https://github.com/danilomoreiraai/skip-the-trip/issues/39) |
| Building, floor and category | Each group and option has an understandable name, role, selected state and logical order. Unavailable buildings are explained. | Pending |
| Lookup without location permission | Status is reachable and understandable without granting location. Empty information is not interpreted as available. | Pending |
| Status and counters | Available, unavailable, unknown, vote counts, freshness and meter value are spoken meaningfully; color is not the only cue. | Pending |
| Yes/No voting | Both actions are distinct, reachable and large enough to activate. The location request is explained before the browser prompt. | Pending |
| Location dialog and failures | Focus is contained; permission denied, unavailable position and retry have understandable next steps. | Pending; [focus defect #39](https://github.com/danilomoreiraai/skip-the-trip/issues/39) |
| Cooldown and updates | After a vote, feedback and cooldown are announced without excessive repeated announcements. | Pending |
| Loading, empty and API error | Loading is announced; empty is distinct from available; error and retry are operable. | Pending |
| Privacy and support | Privacy, privacy email and support email can be found and activated. | Pending |
| Increased text and zoom | At platform larger-text setting and browser zoom, all critical controls remain visible and reachable with no obscured content. | Pending |
| Orientation, contrast and motion | Portrait and one orientation change work; status has text cues; reduced-motion setting removes distracting motion. | Pending |

## Participant task script

Give the task without naming the controls to press. Record whether the participant completed it independently, needed a prompt, could not complete it, or was ineligible. Ask the comprehension question *after* the action to avoid leading the participant.

1. **Status lookup:** “Find the latest information for the bathroom you would use in HH5.” Ask: “If there is no recent information, what does that mean?”
2. **First vote (eligible participants only):** “If you are at HH5 and know whether this bathroom is available, share that information.” Ask: “Why did the site request location? What does Yes or No mean?”
3. **Freshness and cooldown:** “When was the information last updated? Can you vote again now?”
4. **Privacy and help:** “Find where to ask for general help and where to ask a privacy question.”

| Session code | Lookup: independent / prompted / blocked | Vote: eligible? and independent / prompted / blocked | Unknown-state interpretation | Location and Yes/No comprehension | Cooldown and freshness comprehension | Privacy / support found | Observations and issue links |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

**Completion calculation:** count only observed, valid attempts. Lookup rate = independent lookup completions / all lookup attempts. Vote rate = independent first votes / eligible first-vote attempts. Record numerator and denominator, not only a percentage. The #29 thresholds are at least 90% and 80% respectively; no rate can be reported until sessions occur.

| Metric | Independent completions | Valid attempts | Rate | Meets threshold? |
| --- | --- | --- | --- | --- |
| Status lookup | Pending | Pending | Pending | Pending |
| First vote by eligible participants | Pending | Pending | Pending | Pending |

## Finding and retest register

Rate an observed finding **Critical** if it blocks a critical journey with no workaround, **High** if it substantially prevents independent completion or assistive-technology use, **Medium** if it causes recoverable difficulty, and **Low** if it is minor friction. Create a separate issue for each actionable code change, link it to #29, and record the release revision used for retest.

| Finding | Severity | Evidence and affected path | Separate issue | Retest revision / device / result |
| --- | --- | --- | --- | --- |
| Consent modal leaves keyboard focus on background controls in a 375 × 812 Chromium run against `main` `d57bc38`. First Tab reaches the header link; second reaches HH5 while the dialog remains open. Location modal uses the same pattern but awaits direct retest. | High | Local browser reproduction, 14 October 2026; no physical-device or screen-reader claim. | [#39](https://github.com/danilomoreiraai/skip-the-trip/issues/39) | Pending |

## Automated baseline (14 October 2026)

- `npm run test:e2e -- --reporter=line`: 20/20 passed in desktop and mobile Chromium projects against local `main` `d57bc38` with this protocol's added 320 px regression test. This covers automated keyboard and reduced-motion checks, but not physical devices or screen readers.
- At 320 CSS px, the complete lookup showed no horizontal document overflow (`scrollWidth = innerWidth = 320`). Enabled buttons measured at least 24 CSS px in each dimension. The isolated Privacy link measured 23.5 CSS px tall and must be checked for comfortable activation on physical devices. This is a local Chromium observation, not an increased platform-text-size result.
- The real-device and participant tables remain unfilled. The acceptance checkboxes in #29 should remain open until observations, defects, and retests are recorded.
