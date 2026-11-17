# Parallel discovery: what would and would not help

This is a design review, not an implemented fallback or a demonstrated fix. The production discovery sources remain unchanged. The empty-state illustration and recovery-copy refinement are implemented separately.

## Distinguish a candidate from permission

The personal entry list is explicitly described as entries the user can access. Organization entries are an inventory. ACUs are controllers: their labels and IDs must never become door names or unlock IDs. Own-user ACU shadow data can contain entry-reference keys, but a controller reference is not evidence that every attached entry belongs to the user's access grant. [Personal entries](https://openpath.readme.io/reference/listuserentries), [organization entries](https://openpath.readme.io/reference/listentries), [user ACUs](https://openpath.readme.io/reference/listuseracus).

For the tested account, personal entries and personal ACUs both returned successful empty lists; organization entries returned 403. Running the same requests concurrently changes latency, not those results. This is not evidence about Mohamed's raw responses. The newly broadened standalone-COE filter addresses naming only and has not been retested in a new APK.

## Bounded fallback worth considering

1. Keep personal entry discovery as the primary source. If it finds no COE candidate, organization entry inventory and personal ACUs can be read concurrently as supplementary sources, with bounded pagination and explicit per-source results.
2. Use only verified entry objects as candidates. If an ACU supplies entry IDs, resolve their names and location context through a documented entry-detail operation using the same user's token. Bound this fan-out; do not guess IDs, routes or expansions. A denied detail read cannot produce a usable target. [Entry details](https://openpath.readme.io/reference/describeentry).
3. Deduplicate by verified organization/entry identity, never by a name or ACU ID. If sources disagree on an entry's metadata, require reconciliation rather than selecting whichever response finishes first. Apply the standalone-COE name rule to resolved entry names.
4. Retain provenance and visibility/authorization distinctions. An organization-only or controller-only candidate must not be described as an authorized personal door. Its treatment requires an explicit product decision about showing candidates with unverified access; unioning it into the current personal-access list would erase that distinction.
5. Preserve 401/session invalidation, explicit 403s, malformed responses and incomplete reads. Do not silently turn failed supplementary reads into a verified empty inventory. Continue to use the employee's own Cloud Key and explicit confirmation; no hardware command, controller ID or shared credential substitutes for the documented entry unlock request.

Recommendation: do not add every hardware read to every screen load. The three-source fallback above is a reasonable investigation/design option, but there is no evidence yet that it supplies a valid missing target. It cannot make discovery fail-proof or repair a permission/context mismatch. Implement it only with a clear candidate-versus-authorized-door contract, and validate that contract with captured provider responses before another release build.
