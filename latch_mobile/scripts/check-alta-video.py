#!/usr/bin/env python3
"""Inspect Alta Video authentication and access-control discovery; cannot unlock."""

import argparse
import datetime
import http.client
from http.cookies import SimpleCookie
import json
import os
from pathlib import Path
import re
import runpy
import ssl
import sys
import time
from urllib.parse import urlsplit

redact = runpy.run_path(str(Path(__file__).with_name('check-alta-profile.py')))['redact']
MAX_BYTES = 1_048_576
READS = ('/api/v1/auth', '/api/v1/me', '/api/v1/openpathConfig',
         '/api/v1/accessControlServers', '/api/v1/accessControlPoints', '/api/v1/availableAccessPoints')
AUTH_WRITES = ('/api/v1/dologin', '/api/v1/totp')
SERVER_FIELDS = ('id', 'provider', 'name', 'region', 'openpath_org_id', 'unified')
POINT_FIELDS = ('guid', 'id_on_server', 'name', 'name_on_server', 'server_guid',
                'server_group_id', 'device_group_id', 'label_ids', 'type')


def origin_host(origin):
    parsed = urlsplit(origin)
    host = parsed.hostname or ''
    supported = any(host.endswith(suffix) for suffix in
                    ('.alta.avigilon.com', '.aware.avasecurity.com', '.aware.ava.uk'))
    if (parsed.scheme != 'https' or not supported or parsed.username or parsed.password
            or parsed.port not in (None, 443) or parsed.path not in ('', '/')
            or parsed.query or parsed.fragment):
        raise ValueError('Use only the HTTPS origin of your confirmed Alta Video deployment, without a path or query.')
    return host


def diagnostic_body(path, body, status=200):
    if path in AUTH_WRITES:
        return {'jsonResponseKeys': list(body) if isinstance(body, dict) else [],
                'errorDetails': {key: body[key] for key in ('kind', 'code', 'error', 'message', 'detail', 'reason', 'statusCode')
                                 if isinstance(body, dict) and key in body} if status != 200 else None,
                'note': 'Authentication response values omitted; cookie stays in process memory.'}
    if path == '/api/v1/accessControlServers':
        # Integration-server responses can contain credential configuration.
        return ([{key: row.get(key) for key in SERVER_FIELDS} if isinstance(row, dict) else '<INVALID ROW>'
                 for row in body] if isinstance(body, list) else {'unexpectedResponseType': type(body).__name__})
    if path == '/api/v1/accessControlPoints':
        # Omit links and associated camera metadata; retain door identity only.
        return ([{key: row.get(key) for key in POINT_FIELDS} if isinstance(row, dict) else '<INVALID ROW>'
                 for row in body] if isinstance(body, list) else {'unexpectedResponseType': type(body).__name__})
    if path == '/api/v1/auth' and isinstance(body, dict):
        return {key: body.get(key) for key in ('username', 'mfaChallengeRequired', 'mfaRequired',
                'mfaResetRequired', 'pwResetRequired', 'totpAuthenticators')}
    return body


class VideoClient:
    def __init__(self, host, report, secrets):
        self.host, self.report, self.secrets = host, report, secrets
        self.cookie = None

    def request(self, method, path, body=None):
        if not ((method == 'GET' and path in READS and body is None)
                or (method == 'POST' and path in AUTH_WRITES and isinstance(body, dict))):
            raise ValueError('Route is outside this read-only diagnostic.')
        headers = {'Accept': 'application/json'}
        if self.cookie:
            headers['Cookie'] = 'va=' + self.cookie
        if body is not None:
            headers['Content-Type'] = 'application/json'
        connection = http.client.HTTPSConnection(self.host, timeout=15, context=ssl.create_default_context())
        started = time.monotonic()
        record = {'method': method, 'path': path}
        self.report['requests'].append(record)
        try:
            connection.request(method, path, json.dumps(body).encode() if body is not None else None, headers)
            response = connection.getresponse()
            record.update(status=response.status, durationMs=round((time.monotonic() - started) * 1000))
            # Never print, persist or forward a cookie to another origin.
            for name, value in response.getheaders():
                if name.lower() == 'set-cookie':
                    cookies = SimpleCookie()
                    cookies.load(value)
                    if 'va' in cookies:
                        self.cookie = cookies['va'].value or None
                        if self.cookie:
                            self.secrets.append(self.cookie)
                        record['videoCookieReceived'] = self.cookie is not None
            raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                record['body'] = '<OMITTED: response exceeds 1 MiB>'
                return response.status, None
            try:
                value = json.loads(raw) if raw else None
            except (ValueError, UnicodeError):
                record['body'] = '<OMITTED: response is not JSON>'
                return response.status, None
            record['body'] = diagnostic_body(path, value, response.status)
            return response.status, value
        finally:
            connection.close()


def probe(client, username, password, secrets, read_code=input):
    status, _ = client.request('POST', '/api/v1/dologin', {'username': username, 'password': password})
    if status != 200 or not client.cookie:
        return 'Video login did not establish the documented session. Native/unified sign-in compatibility remains unresolved.', 1
    status, auth = client.request('GET', '/api/v1/auth')
    if status != 200 or not isinstance(auth, dict):
        return 'Video authentication-state read failed. No discovery sent.', 1
    if auth.get('mfaResetRequired') or auth.get('pwResetRequired'):
        return 'Video requires password/MFA setup or reset. This diagnostic does not change account security.', 1
    if auth.get('mfaChallengeRequired') is True:
        name = read_code('Authenticator name (Enter for the default): ').strip()
        code = read_code('Current six-digit authenticator code: ').strip()
        if not re.fullmatch(r'[0-9]{6}', code):
            return 'Invalid code format. No MFA submission or discovery sent.', 1
        secrets.append(code)
        status, _ = client.request('POST', '/api/v1/totp', {'code': code, 'name': name})
        if status != 200:
            return 'Video MFA submission was not accepted. No retry or discovery sent.', 1
        status, auth = client.request('GET', '/api/v1/auth')
    if (status != 200 or not isinstance(auth, dict) or auth.get('mfaChallengeRequired') is not False
            or auth.get('mfaResetRequired') is not False or auth.get('pwResetRequired') is True):
        return 'Video authentication readiness could not be verified. Inspect the recorded flags; no discovery sent.', 1
    client.report['videoSessionVerified'] = True
    for path in READS[1:]:
        status, value = client.request('GET', path)
        if status == 401:
            return 'Video session was rejected during discovery. No further requests sent.', 1
        if path == '/api/v1/accessControlPoints' and status == 200 and isinstance(value, list):
            client.report['pointSummary'] = [
                {'guid': row.get('guid'), 'name': row.get('name'), 'nameOnServer': row.get('name_on_server'),
                 'serverGuid': row.get('server_guid'), 'idOnServer': row.get('id_on_server')}
                for row in value if isinstance(row, dict)]
    return 'Video discovery recorded. Read denials remain explicit; no camera feeds, bridge tokens or unlocks requested.', 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', required=True, help='Confirmed deployment HTTPS origin; never guessed from an Access namespace.')
    parser.add_argument('--output', type=Path, required=True, help='New local redacted report, permissions 0600.')
    args = parser.parse_args()
    try:
        host = origin_host(args.origin)
    except ValueError as error:
        parser.error(str(error))
    if not sys.stdin.isatty() or args.output.exists():
        parser.error('Run interactively and choose a NEW output filename. No request sent.')
    print(f'Using your confirmed Alta Video deployment: https://{host}')
    print('Individual Video login and access-control discovery only. No redirects, retries, cameras or unlocks.')
    print('Inputs are visible locally, as requested. Cookies stay in memory; integration credentials are omitted.')
    username = input('Your Video sign-in email: ').strip()
    password = input('Your password: ')
    if not username or not password:
        parser.error('Email and password are required. No request sent.')
    report = {'timestampUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'origin': f'https://{host}', 'mode': 'read-only-video-discovery', 'requests': []}
    secrets = [password]
    client = VideoClient(host, report, secrets)
    status = 1
    try:
        report['result'], status = probe(client, username, password, secrets)
    except (OSError, http.client.HTTPException) as error:
        report['result'] = f'Diagnostic stopped: {type(error).__name__}. Raw exception omitted; no retry.'
    except (KeyboardInterrupt, EOFError):
        report['result'] = 'Cancelled. No further requests sent.'
        status = 130
    finally:
        client.cookie = None
    rendered = json.dumps(redact(report, secrets), indent=2, ensure_ascii=True) + '\n'
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
