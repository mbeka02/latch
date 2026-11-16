#!/usr/bin/env python3
"""Inspect Alta login + own-user profile responses locally, without door requests."""

import argparse
import datetime
import http.client
import json
import os
import re
import ssl
import sys
import time
from pathlib import Path

MAX_BYTES = 1_048_576
MAX_ID = 9_007_199_254_740_991
HEADERS = ('Content-Type', 'Date', 'X-Request-ID', 'X-Correlation-ID',
           'X-Amzn-RequestId', 'X-Amzn-Trace-Id', 'Traceparent', 'CF-Ray', 'Retry-After')


def numeric_id(value):
    return type(value) in (int, float) and 0 < value <= MAX_ID and int(value) == value


def redact(value, secrets):
    """Keep complete JSON structure and personal profile data, but remove secrets."""
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            normalized = re.sub(r'[^a-z0-9]', '', key.lower())
            sensitive = (('token' in normalized and 'scope' not in normalized)
                         or normalized in ('mfa', 'credentials', 'credential', 'cloudkey', 'seed', 'cookie', 'setcookie')
                         or any(word in normalized for word in
                                ('password', 'secret', 'authorization', 'privatekey', 'apikey', 'totp', 'recoverycode')))
            result[key] = '<REDACTED>' if sensitive else redact(item, secrets)
        return result
    if isinstance(value, list):
        return [redact(item, secrets) for item in value]
    if isinstance(value, str):
        for secret in sorted((item for item in secrets if item), key=len, reverse=True):
            value = value.replace(secret, '<REDACTED>')
        return re.sub(r'\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b', '<REDACTED_TOKEN>', value)
    return value


def request(host, method, path, body=None, token=None):
    connection = http.client.HTTPSConnection(host, timeout=15, context=ssl.create_default_context())
    headers = {'Accept': 'application/json'}
    if body is not None:
        headers['Content-Type'] = 'application/json; charset=utf-8'
    if token:
        # Alta expects the raw token, matching Latch's native transport.
        headers['Authorization'] = token
    started = time.monotonic()
    try:
        connection.request(method, path, body=json.dumps(body).encode() if body is not None else None, headers=headers)
        response = connection.getresponse()
        raw = response.read(MAX_BYTES + 1)
        record = {'method': method, 'path': path, 'status': response.status,
                  'durationMs': round((time.monotonic() - started) * 1000),
                  'headers': {name: response.getheader(name) for name in HEADERS if response.getheader(name)}}
        if len(raw) > MAX_BYTES:
            record['body'] = '<OMITTED: response exceeds 1 MiB>'
            return record, None
        try:
            value = json.loads(raw)
        except (ValueError, UnicodeError):
            # An unparsed login body cannot be reliably stripped of opaque tokens.
            record['body'] = '<OMITTED: response is not valid JSON>'
            return record, None
        record['body'] = value
        return record, value
    finally:
        connection.close()


class InvalidProfile(Exception):
    pass


def validate_profile(response, identity_id, org_id, user_id, previous_email=None):
    """Match profileSession() in src/services/openpath.ts, including first failure."""
    checks = []

    def check(path, valid, reason):
        checks.append({'field': path, 'passed': bool(valid), **({'reason': reason} if not valid else {})})
        if not valid:
            raise InvalidProfile

    def nonempty(value):
        return isinstance(value, str) and bool(value.strip())

    try:
        check('response', isinstance(response, dict), 'Expected a JSON object.')
        data = response.get('data')
        check('data', isinstance(data, dict), 'Expected an object under data.')
        identity = data.get('identity')
        check('data.identity', isinstance(identity, dict), 'Expected an identity object.')
        check('data.id', numeric_id(data.get('id')), 'Expected a positive safe integer user ID.')
        check('data.id.matchesRequestedUser', data['id'] == user_id, 'Returned user does not match the requested user.')
        check('data.identity.id', numeric_id(identity.get('id')), 'Expected a positive safe integer identity ID.')
        check('data.identity.id.matchesLogin', identity['id'] == identity_id, 'Profile identity does not match login identity.')
        check('data.identity.email', nonempty(identity.get('email')), 'Expected a nonempty email string.')
        email = identity['email'].strip()
        check('data.identity.email.consistent', previous_email is None or previous_email == email,
              'Profiles from different memberships returned different emails.')
        # JS uses fullName ?? email: null/missing falls back; an empty string fails.
        name = identity.get('fullName')
        check('data.identity.fullNameOrEmail', nonempty(email if name is None else name),
              'fullName is present but empty or has the wrong type; Latch only falls back for null/missing.')
        users = identity.get('users')
        check('data.identity.users', isinstance(users, list), 'Expected the identity.users array.')
        for index, item in enumerate(users):
            check(f'data.identity.users[{index}]', isinstance(item, dict), 'Expected an association object.')
        matches = []
        for index, item in enumerate(users):
            if not numeric_id(item.get('id')) or item['id'] != user_id:
                continue
            org = item.get('org')
            check(f'data.identity.users[{index}].org', isinstance(org, dict), 'Expected an organisation object for this user.')
            if numeric_id(org.get('id')) and org['id'] == org_id:
                matches.append(org)
        check('data.identity.users.matchingAssociation', len(matches) == 1,
              'Expected exactly one association matching both login user ID and organisation ID.')
        check('data.identity.users.matchingAssociation.org.name', nonempty(matches[0].get('name')),
              'The matching organisation name is missing, null, empty or not a string.')
        return {'passed': True, 'checks': checks}, email
    except InvalidProfile:
        return {'passed': False, 'failedAt': checks[-1]['field'], 'checks': checks}, previous_email


def probe(host, email, password, code, namespace, report, secrets):
    body = {'email': email.strip(), 'password': password}
    if namespace:
        body['namespaceNickname'] = namespace
    if code:
        body['mfa'] = {'totpCode': code}
    record, login = request(host, 'POST', '/auth/login', body=body)
    report['requests'].append(record)
    if record['status'] != 201 or not isinstance(login, dict) or not isinstance(login.get('data'), dict):
        report['result'] = 'Login did not return the expected HTTP 201 JSON data object. No profile request sent.'
        return 1
    data = login['data']
    token, identity_id = data.get('token'), data.get('identityId')
    if isinstance(token, str) and token:
        secrets.append(token)
    if not isinstance(token, str) or not token.strip() or not numeric_id(identity_id):
        report['result'] = 'Login token or identityId is missing/invalid. No profile request sent.'
        return 1
    rows = data.get('tokenScopeList')
    if not isinstance(rows, list):
        report['result'] = 'Login tokenScopeList is missing or is not an array. No profile request sent.'
        return 1
    associations = []
    for row in rows:
        if not isinstance(row, dict):
            report['result'] = 'Login tokenScopeList contains a non-object. No profile request sent.'
            return 1
        org, user = row.get('org'), row.get('user')
        if org is None or user is None:
            continue
        if not isinstance(org, dict) or not isinstance(user, dict):
            report['result'] = 'Login org/user association is malformed. No profile request sent.'
            return 1
        org_id, user_id = org.get('id'), user.get('id')
        if org_id is None or user_id is None:
            continue
        if not numeric_id(org_id) or not numeric_id(user_id):
            report['result'] = 'Login org/user IDs are invalid. No profile request sent.'
            return 1
        associations.append((int(org_id), int(user_id)))
    if not 1 <= len(associations) <= 100:
        report['result'] = 'Login has no usable user association or exceeds Latch’s 100-association limit.'
        return 1
    report['loginAccepted'] = True
    previous_email = None
    for org_id, user_id in dict.fromkeys(associations):
        record, profile = request(host, 'GET', f'/orgs/{org_id}/users/{user_id}', token=token.strip())
        report['requests'].append(record)
        if record['status'] != 200:
            report['result'] = 'Profile request did not return HTTP 200. No further requests sent.'
            return 1
        validation, previous_email = validate_profile(profile, identity_id, org_id, user_id, previous_email)
        record['latchProfileValidation'] = validation
        if not validation['passed']:
            report['result'] = 'HTTP 200 profile rejected by current Latch validation: ' + validation['failedAt']
            return 1
    report['result'] = 'All profile checks passed. This does not test native transport, storage, door access or unlocking.'
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--region', choices=('eu', 'us'), default='eu', help='Default: eu, matching preview 4. No regional fallback.')
    parser.add_argument('--namespace', default='org:ifss-group', help='Exact public namespace; default: org:ifss-group.')
    parser.add_argument('--output', type=Path, help='Optionally save the redacted report to a NEW local file (permissions 0600).')
    args = parser.parse_args()
    if not sys.stdin.isatty():
        parser.error('Run interactively in your own terminal; credentials are not accepted through a pipe or flags.')
    host = {'eu': 'api.eu.openpath.com', 'us': 'api.openpath.com'}[args.region]
    report = {'timestampUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'origin': f'https://{host}', 'namespace': args.namespace, 'requests': [],
              'note': 'Complete JSON responses, with tokens/passwords/authenticator secrets redacted. Profile personal data remains visible.'}
    print(f'Using https://{host}, namespace {args.namespace}. One login, then own-user profile reads only.')
    print('No redirects, retries, entry/credential reads, unlock requests or Sentry uploads.')
    print('Inputs are visible in this terminal, as requested; they are not written to the report.')
    email = input('Alta email: ').strip()
    password = input('Alta password: ')
    code = input('Authenticator code (Enter to omit): ').strip()
    if not email or not password or (code and not re.fullmatch(r'[0-9]{6}', code)):
        parser.error('Email/password are required; an optional authenticator code must contain six digits. No request sent.')
    secrets = [password, code]
    if args.output and args.output.exists():
        parser.error('Output file already exists. Choose a new file or remove it yourself. No request sent.')
    status = 1
    try:
        status = probe(host, email, password, code, args.namespace, report, secrets)
    except (OSError, http.client.HTTPException) as error:
        report['result'] = f'No usable response: {type(error).__name__}. Raw exception omitted.'
    except (KeyboardInterrupt, EOFError):
        report['result'] = 'Cancelled; no further requests sent.'
        status = 130
    rendered = json.dumps(redact(report, secrets), indent=2, ensure_ascii=True) + '\n'
    print(rendered, end='')
    if args.output:
        try:
            descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, 'w') as output:
                output.write(rendered)
            print(f'Report saved to {args.output}')
        except OSError as error:
            print(f'Could not save report: {type(error).__name__}. The report is printed above.', file=sys.stderr)
            return 1
    return status


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (KeyboardInterrupt, EOFError):
        print('\nCancelled.')
        sys.exit(130)
