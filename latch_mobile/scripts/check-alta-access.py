#!/usr/bin/env python3
"""Read-only Alta access investigation: login, profile, entries, keys and assignments."""

import argparse
import datetime
import http.client
import json
import os
import re
import runpy
import sys
from pathlib import Path

shared = runpy.run_path(str(Path(__file__).with_name('check-alta-profile.py')))
request = shared['request']
numeric_id = shared['numeric_id']
VARIANTS = ('mobile', 'card', 'pincode', 'cardMifareCsn', 'cardOpenpathDesfireEv1',
            'cloudKey', 'fobAllegion', 'allegionMobile', 'licensePlate', 'wallet')


def credential_metadata(item):
    """Do not print provisioning material, PINs or physical credential secrets."""
    if not isinstance(item, dict):
        return {'invalidCredential': True}
    variants = [name for name in VARIANTS if item.get(name) is not None]
    return {**{key: item.get(key) for key in ('id', 'startDate', 'endDate')},
            'variantNames': variants,
            'variantIds': {key: item[key].get('id') if isinstance(item[key], dict) else None
                           for key in variants},
            'credentialType': {key: item['credentialType'].get(key) for key in ('id', 'name', 'modelName')}
            if isinstance(item.get('credentialType'), dict) else None}


def paged(host, token, base, resource, report):
    items, seen = [], set()
    for _ in range(101):
        offset = len(items)
        if offset > 10_000:
            break
        sort = 'zoneShare.zone.name' if resource == 'zoneUsers' else 'id'
        record, body = request(host, 'GET', f'{base}/{resource}?limit=100&offset={offset}&sort={sort}&order=asc', token=token)
        report['requests'].append(record)
        if resource == 'credentials' and isinstance(body, dict):
            record['body'] = ({**body, 'data': [credential_metadata(item) for item in body['data']]}
                              if isinstance(body.get('data'), list) else '<OMITTED: malformed credential response>')
            record['credentialPayloadPolicy'] = 'Only type, IDs and validity dates retained; credential secrets omitted.'
        if record['status'] != 200 or not isinstance(body, dict) or not isinstance(body.get('data'), list):
            return {'complete': False, 'status': record['status'], 'items': items,
                    'reason': 'Expected HTTP 200 and a data array.'}
        page = body['data']
        count = body.get('filteredCount', body.get('totalCount'))
        if count is not None and (type(count) is not int or count < offset + len(page)
                                  or (not page and count != offset)):
            return {'complete': False, 'items': items, 'reason': 'Inconsistent pagination count.'}
        if not page:
            return {'complete': True, 'count': len(items), 'items': items}
        for item in page:
            # zoneUsers rows have zone/schedule objects, not a top-level id.
            item_key = (json.dumps(item, sort_keys=True) if resource == 'zoneUsers'
                        else item.get('id') if isinstance(item, dict) else None)
            valid = isinstance(item, dict) and (resource == 'zoneUsers' or numeric_id(item_key))
            if not valid or item_key in seen:
                return {'complete': False, 'items': items, 'reason': 'Invalid or repeated object ID.'}
            seen.add(item_key)
            items.append(credential_metadata(item) if resource == 'credentials' else item)
    return {'complete': False, 'items': items, 'reason': 'Diagnostic pagination bound reached.'}


def inspect_access(host, token, associations, report):
    report['accessChecks'] = []
    for org_id, user_id in associations:
        base = f'/orgs/{org_id}/users/{user_id}'
        record, body = request(host, 'GET', base + '/entries', token=token)
        report['requests'].append(record)
        discovery = shared['describe_entries'](body) if record['status'] == 200 else {
            'responseValid': False, 'problems': [f'HTTP {record["status"]}']}
        check = {'orgId': org_id, 'userId': user_id, 'entries': discovery}
        record, _ = request(host, 'GET', base + '?options=withRoles,withUserSites,withRealUserGroups', token=token)
        report['requests'].append(record)
        # Keep investigating independent reads even if entries is empty/denied.
        # None of these endpoints grants access or changes configuration.
        for resource in ('credentials', 'groups', 'zones', 'sites'):
            key = 'credentialInventory' if resource == 'credentials' else resource
            check[key] = paged(host, token, base, resource, report)
        check['zoneAssignmentRecords'] = paged(host, token, base, 'zoneUsers', report)
        check['groupDetails'] = []
        # Only groups returned for this user, not an organization-wide search.
        # These reads document broader scopes; a 403 is expected for limited
        # user tokens and does not prove the group has no entry assignments.
        for group in check['groups']['items'][:10]:
            group_base = f'/orgs/{org_id}/groups/{int(group["id"])}'
            details = {'groupId': group['id'], 'name': group.get('name'), 'reads': []}
            for suffix in ('', '/entries', '/zones?limit=100&offset=0&sort=id&order=asc'):
                record, _ = request(host, 'GET', group_base + suffix, token=token)
                report['requests'].append(record)
                details['reads'].append({'path': record['path'], 'status': record['status']})
            details['note'] = 'A denied group read is not an empty assignment. Zones read is first-page evidence only.'
            check['groupDetails'].append(details)
        check['groupDetailLimit'] = 10
        keys = [item for item in check['credentialInventory']['items'] if item.get('variantNames') == ['cloudKey']]
        check['cloudKeyCount'] = len(keys)
        check['note'] = ('Counts and flags do not prove unlock authorisation. No unlock request was sent. '
                         'An empty entries result does not prove portal revocation caused missing access.')
        report['accessChecks'].append(check)
    report['result'] = 'Read-only access inspection finished. Compare entries, Cloud Keys, groups, zones and sites; no unlocks sent.'
    return 0 if all(check['entries']['responseValid'] and
                    all(check[key]['complete'] for key in ('credentialInventory', 'groups', 'zones', 'sites', 'zoneAssignmentRecords'))
                    for check in report['accessChecks']) else 1


def inspect_zone_records(host, token, associations, report):
    report['zoneAssignmentChecks'] = []
    for org_id, user_id in associations:
        result = paged(host, token, f'/orgs/{org_id}/users/{user_id}', 'zoneUsers', report)
        report['zoneAssignmentChecks'].append({'orgId': org_id, 'userId': user_id, **result})
    report['result'] = 'Targeted own-user zone-assignment inspection; no other access reads or unlocks sent.'
    return 0 if all(row['complete'] for row in report['zoneAssignmentChecks']) else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True, help='New redacted local report, permissions 0600.')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--compare-mobile-login', action='store_true',
                      help='Read-only comparison: fresh login without forMobileLogin versus with true. No assumed fix.')
    mode.add_argument('--zone-assignments-only', action='store_true',
                      help='Only login, profile validation and user zone-assignment records; use the documented nested sort.')
    args = parser.parse_args()
    if not sys.stdin.isatty():
        parser.error('Run interactively; do not supply credentials through flags or pipes.')
    if args.output.exists():
        parser.error('Output exists. Choose another filename. No request sent.')
    print('EU API, org:ifss-group. Fresh login and read-only access diagnostics.')
    if args.compare_mobile_login:
        print('Controlled comparison: two logins, changing only forMobileLogin from omitted to true.')
    if args.zone_assignments_only:
        print('Targeted mode: only own-user profile and zone-assignment records after login.')
    else:
        print('Includes user zone-assignment records and bounded reads of groups returned for your user (may return 403).')
    print('No redirects, retries, token refresh, credential creation or unlocking. Inputs are visible locally.')
    email = input('Alta email: ').strip()
    password = input('Alta password: ')
    code = input('Authenticator code (Enter to omit): ').strip()
    if not email or not password or (code and not re.fullmatch(r'[0-9]{6}', code)):
        parser.error('Email/password required; optional authenticator code must have six digits.')
    secrets = [password, code]
    report = {'timestampUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'origin': 'https://api.eu.openpath.com', 'namespace': 'org:ifss-group',
              'mode': 'read-only-access', 'requests': []}
    status = 1
    try:
        if args.compare_mobile_login:
            report['mode'] = 'read-only-mobile-login-comparison'
            report['runs'] = []
            results = []
            for label, flag in (('forMobileLogin omitted (app behaviour)', None), ('forMobileLogin true', True)):
                run = {'variant': label, 'requests': []}
                report['runs'].append(run)
                results.append(shared['probe']('api.eu.openpath.com', email, password, code, 'org:ifss-group',
                                                run, secrets, inspect_access=inspect_access, for_mobile_login=flag))
                # Failed authentication/MFA is not retried under a different login flag.
                if not run.get('loginAccepted'):
                    break
            status = 0 if len(results) == 2 and all(result == 0 for result in results) else 1
            report['result'] = 'Comparison recorded; inspect each run independently. No unlocks or permission changes.'
        else:
            status = shared['probe']('api.eu.openpath.com', email, password, code, 'org:ifss-group',
                                     report, secrets, inspect_access=inspect_zone_records if args.zone_assignments_only else inspect_access)
    except (OSError, http.client.HTTPException) as error:
        report['result'] = f'Diagnostic stopped: {type(error).__name__}. Raw exception omitted; no retry.'
    except (KeyboardInterrupt, EOFError):
        report['result'] = 'Cancelled. No further requests sent.'
        status = 130
    rendered = json.dumps(shared['redact'](report, secrets), indent=2, ensure_ascii=True) + '\n'
    descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        output.write(rendered)
    print(rendered, end='')
    print(f'Report saved to {args.output}')
    return status


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (KeyboardInterrupt, EOFError):
        print('\nCancelled.')
        sys.exit(130)
