# Optional beta feedback and defect triage

The beta link is shared in a group with spontaneous participation. No registration,
participant count or device inventory is required. Danilo Moreira reviews optional
feedback at `support@skipthetrip.info` and owns triage and pause decisions under
[the operations playbook](closed-beta-operations.md). This is periodic review,
not a continuously staffed support service.

## Short optional report

- What were you trying to do?
- What happened, and what did you expect?
- Approximate time, if known.
- Optional: browser/device details or a safely cropped screenshot, only if useful.

Do not send exact coordinates, cookies, anonymous IDs, credentials, private contact
details in the report text, or raw logs. Email naturally exposes the sender's
address to the recipient; no anonymous-feedback promise is made. Do not copy
addresses or original messages into GitHub. Privacy/deletion requests go privately
to `privacy@skipthetrip.info` under the existing rights workflow.

## Triage

| Severity | Meaning | Response and retest |
| --- | --- | --- |
| P0 | Privacy/security exposure, data-integrity failure or total outage | Follow incident response and pause on discovery; resolve/contain and retest before resuming. |
| P1 | A core lookup or eligible-contribution journey is blocked | Pause pending investigation; reproduce where possible and retest the affected flow before resuming. |
| P2 | Recoverable functional or accessibility defect | Record owner, safe mitigation and next review/retest date; may continue if no stop condition applies. |
| P3 | Copy, polish or minor confusion | Record owner and review/retest expectation; prioritize by effect on use. |

Review incoming feedback at each scheduled beta review and when a serious report
or alert is received. Acknowledge at the next review when possible; do not promise
immediate responses. Existing incident acknowledgement targets still apply.

For each accepted defect, create one English GitHub issue before any code or
configuration change. Include severity, owner, affected release (or unknown pending
investigation), task, expected/observed behavior, reproduction attempt, mitigation
and retest requirement. Device context is optional: record unknown when absent.
Do not infer a reported release from the current production SHA without evidence.
If reproduction fails, keep the report unconfirmed and request only useful optional
details; do not mark it resolved just because it cannot be reproduced.

P0/P1 block #35 or require pausing an already open experiment. Retest fixes against
the deployed revision and the original failure; simulated tests must be labelled
as such. No feedback does not establish successful use or absence of defects.

## Synthetic example — not an observed defect

> Task: view a bathroom status after temporarily losing connectivity. Expected:
> recover through retry. Observed in this fictional example: retry stays disabled.
> Approximate time: unknown. Device: not supplied. Release: unknown pending
> investigation. Severity: P2 if reload safely restores lookup; otherwise reassess
> as P1. Owner: Danilo Moreira. Retest: reproduce offline/reconnect/retry, verify
> recovery and file a separate issue if accepted. No real participant report or
> product defect is asserted by this example.

## Retention and delivery evidence

Keep raw messages in the support mailbox only while needed. Review and delete
resolved feedback within 30 days after beta closure, subject to a documented
incident, rights-request or legal hold. Keep sanitized issue summaries only.
Do not add telemetry, session replay, profiling or participant/device tracking.

This document delivers the template and rubric for #34. Actual group notification,
mailbox monitoring and links from real findings to issues remain pending until
performed. The synthetic example is a procedure walkthrough, not participant evidence.
