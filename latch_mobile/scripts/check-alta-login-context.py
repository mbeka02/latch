#!/usr/bin/env python3
"""Compare matching Alta identities and personal versus organization entry reads; no unlocks."""

import argparse
import datetime
import http.client
import json
import os
from pathlib import Path
import re
import runpy
import sys

shared = runpy.run_path(str(Path(__file__).with_name('check-alta-profile.py')))
request = shared['request']
numeric_id = shared['numeric_id']
HOST = 'api.eu.openpath.com'


def entry_summary(body):
    if not isinstance(body, dict) or not isinstance(body.get('data'), list):
        return body
    rows = []
    for row in body['data']:
        if not isinstance(row, dict):
            rows.append('<INVALID ENTRY>')
            continue
        zone = row.get('zone')
        site = zone.get('site') if isinstance(zone, dict) else None
        rows.append({'id': row.get('id'), 'name': row.get('name'),
                     'zone': {key: zone.get(key) for key in ('id', 'name')} if isinstance(zone, dict) else None,
                     'site': {key: site.get(key) for key in ('id', 'name')} if isinstance(site, dict) else None})
    return {**{key: body[key] for key in ('totalCount', 'filteredCount') if key in body}, 'data': rows}


def probe(email, password, code, report, secrets):
    body = {'email': email, 'password': password}
    if code:
        body['mfa'] = {'totpCode': code}
    # loginAll explicitly forbids a namespace: it finds successful matches.
    record, response = request(HOST, 'POST', '/auth/loginAll', body=body)
    report['requests'].append(record)
    if record['status'] != 201 or not isinstance(response, dict) or not isinstance(response.get('data'), list):
        report['result'] = 'loginAll did not return its documented 201 data array. No retry or discovery sent.'
        return 1
    matches = response['data']
    if not 1 <= len(matches) <= 10:
        report['result'] = 'No matching identities, or the ten-identity diagnostic bound was exceeded. No discovery sent.'
        return 1
    report['identityChecks'] = []
    for match in matches:
        if not isinstance(match, dict):
            report['result'] = 'Malformed identity match. No further requests sent.'
            return 1
        identity = match.get('identity')
        identity_id, token = match.get('identityId'), match.get('token')
        if (not isinstance(identity, dict) or not numeric_id(identity_id) or identity.get('id') != identity_id
                or not isinstance(token, str) or not token.strip() or not isinstance(match.get('tokenScopeList'), list)):
            report['result'] = 'Malformed identity/token association. No further requests sent.'
            return 1
        secrets.append(token)
        token = token.strip()
        check = {'identityId': identity_id, 'namespace': identity.get('namespace'), 'associations': []}
        report['identityChecks'].append(check)
        associations = set()
        for scope in match['tokenScopeList']:
            if not isinstance(scope, dict):
                report['result'] = 'Malformed scope association. No further requests sent.'
                return 1
            org, user = scope.get('org'), scope.get('user')
            if not isinstance(org, dict) or not isinstance(user, dict):
                continue
            if numeric_id(org.get('id')) and numeric_id(user.get('id')):
                associations.add((int(org['id']), int(user['id'])))
        if len(associations) > 10:
            report['result'] = 'Ten-association diagnostic bound exceeded. No further requests sent.'
            return 1
        for org_id, user_id in sorted(associations):
            association = {'orgId': org_id, 'userId': user_id}
            check['associations'].append(association)
            record, profile = request(HOST, 'GET', f'/orgs/{org_id}/users/{user_id}', token=token)
            report['requests'].append(record)
            data = profile.get('data') if isinstance(profile, dict) else None
            profile_identity = data.get('identity') if isinstance(data, dict) else None
            if (record['status'] != 200 or not isinstance(data, dict) or data.get('id') != user_id
                    or not isinstance(profile_identity, dict) or profile_identity.get('id') != identity_id):
                association['result'] = 'Own profile/identity could not be verified; entry reads skipped.'
                continue
            association['currentAppProfileValidation'] = shared['validate_profile'](profile, identity_id, org_id, user_id)[0]
            for label, path in (
                    ('personalEntries', f'/orgs/{org_id}/users/{user_id}/entries'),
                    ('organizationEntriesSample', f'/orgs/{org_id}/entries?limit=1&offset=0&sort=name&order=asc')):
                record, entries = request(HOST, 'GET', path, token=token)
                if record['status'] == 200:
                    record['body'] = entry_summary(entries)
                report['requests'].append(record)
                association[label] = {'status': record['status'], 'body': record['body']}
            association['note'] = ('Organization sample is at most one entry, not a COE search or proof of user unlock permission. '
                                   'A 403 is a route denial, not an empty inventory.')
    report['result'] = ('Identity and endpoint comparison recorded. Compare returned identity/namespace/org/user tuples '
                        'with the app context; no password retry, permission changes or unlocks sent.')
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True, help='New redacted local report, permissions 0600.')
    args = parser.parse_args()
    if not sys.stdin.isatty() or args.output.exists():
        parser.error('Run interactively and choose a NEW report filename. No request sent.')
    print('EU only. One loginAll without namespace; own profiles and entry-read comparison per returned identity.')
    print('Organization inventory is sampled with limit=1. No redirects, retries or unlocks. Inputs are visible locally.')
    email = input('Alta email: ').strip()
    password = input('Alta password: ')
    code = input('Authenticator code (Enter to omit): ').strip()
    if not email or not password or (code and not re.fullmatch(r'[0-9]{6}', code)):
        parser.error('Email/password required; optional authenticator code must have six digits.')
    secrets = [password, code]
    report = {'timestampUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'origin': 'https://' + HOST, 'mode': 'read-only-login-context-comparison', 'requests': []}
    status = 1
    try:
        status = probe(email, password, code, report, secrets)
    except (OSError, http.client.HTTPException) as error:
        report['result'] = f'Diagnostic stopped: {type(error).__name__}. Raw exception omitted; no retry.'
    except (KeyboardInterrupt, EOFError):
        report['result'] = 'Cancelled; no further requests sent.'
        status = 130
    rendered = json.dumps(shared['redact'](report, secrets), indent=2, ensure_ascii=True) + '\n'
    with os.fdopen(os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as output:
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
