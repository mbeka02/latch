# ACP mapping and comparable Openpath integrations

Research date: 2026-11-17. This note preserves the current Openpath API approach. ACP means **access control point** in the user's deployment. No tenant calls, runtime changes, or architectural changes were made for this research. There is no verified root cause yet.

## What the comparisons establish

- Trackman's own Openpath setup guide uses an organization ID and entry ID obtained from the administration UI. Its troubleshooting distinguishes administrator privileges from **User Access**: an integration user can have administrative capabilities and still lack access to open the door. This is a useful permission check for the existing API, not evidence that our user's permissions are wrong. The guide's two-factor-authentication restriction belongs to that integration and should not be generalized to the native Openpath API. [Trackman integration guide](https://support.trackmangolf.com/hc/en-us/articles/28668326066971-Integrations-Openpath-Integration)
- USchedule's own setup guide independently calls out User Access separately from administrative access. A valid CloudKey or administrative group membership therefore does not, by itself, settle whether a particular entry is available to the authenticated user. Confirm the actual entry and user-access assignment in the existing Openpath setup. [USchedule setup guide](https://support.uschedule.com/article/104-how-to-set-up-door-access-for-avigilon-alta-openpath)
- The public Android garage project is a useful implementation comparison, but its guest-pass flow is not evidence for employee personal-identity login, entry discovery, or token compatibility. Do not use it to justify a shared-credential design. [blueDog-Consulting/test-alta-garage-android source repository](https://github.com/blueDog-Consulting/test-alta-garage-android)

## ACP labels do not yet establish the Openpath entry mapping

Avigilon's Alta Video integration setup asks for an Openpath organization ID, namespace, and region on the access-control server configuration. Consequently, a Video deployment's organization identifier should not be assumed to be the organization configured on each integrated Openpath server. [Avigilon integration setup](https://docs.avigilon.com/es-ES/bundle/alta-video/page/Integrations/accesscontrol/openpath/add-openpathacserver.htm)

The ACP schema inspected by the parent research exposes `name`, `name_on_server`, `id_on_server`, `server_guid`, and `openpath_url`. These are the relevant configuration links to resolve a remembered Video label such as “COE” to its underlying Openpath server and entry. That relationship is currently unverified; the remembered label alone does not prove which Openpath organization or entry owns the door. This is a possible configuration-mapping gap, not proof that the current organization is wrong.

The practical next comparison is therefore between the configured ACP/server mapping and the current user's actual Openpath entry-access assignment. Empty personal entry lists and a valid CloudKey are observations to reconcile with that mapping; they do not establish an API replacement requirement.

## Limits

The guides above demonstrate real integrations of the existing Openpath system, but neither establishes the tenant's exact employee authentication contract. The guest-pass repository is only a limited comparison. No verified public employee mobile app implementation has been established by this note. The current Openpath API remains the intended integration, and this research does not propose revisiting Video login.
