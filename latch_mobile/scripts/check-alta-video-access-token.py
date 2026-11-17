#!/usr/bin/env python3
"""Test an Openpath Authorization token on one fixed Video ACP read; never unlock."""

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
video = runpy.run_path(str(Path(__file__).with_name('check-alta-video.py')))
ACCESS_HOST = 'api.eu.openpath.com'
VIDEO_HOST = 'ifss-kenya-office.eu2.alta.avigilon.com'
ACP_PATH = '/api/v1/accessControlPoints'


def inspect_video(host, token, associations, report):
    # Deliberate, user-authorized cross-service compatibility experiment. No
    # configurable destination, Bearer prefix, cookie substitution, or redirect.
    record, body = shared['request'](VIDEO_HOST, 'GET', ACP_PATH, token=token)
    record['origin'] = 'https://' + VIDEO_HOST
    record['authenticationMethod'] = 'raw Authorization header; no cookie'
    if record['status'] == 200:
        record['body'] = video['diagnostic_body'](ACP_PATH, body)
    report['requests'].append(record)
    status = record['status']
    if status == 200 and isinstance(body, list):
        report['result'] = f'Video returned an ACP array with {len(body)} item(s). Token compatibility requires comparison with an unauthenticated control; door permission and unlock are not tested.'
        return 0
    report['result'] = (f'Video returned HTTP {status}. This records only the raw Authorization-header experiment; '
                        'it does not test cookie or other authentication methods. No retries or unlocks sent.')
    return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True, help='NEW local redacted JSON report, permissions 0600.')
    args = parser.parse_args()
    if not sys.stdin.isatty() or args.output.exists():
        parser.error('Run interactively and choose a NEW report filename. No request sent.')
    print('One EU Openpath login and own-profile validation, then one Video ACP GET.')
    print('Video destination: https://' + VIDEO_HOST + ACP_PATH)
    print('Your Openpath token is sent there in Authorization only; it is never printed or saved.')
    print('No redirects, cookies, retries, camera requests or unlocks. Inputs are visible locally as requested.')
    email = input('Alta email: ').strip()
    password = input('Alta password: ')
    code = input('Authenticator code (Enter to omit): ').strip()
    if not email or not password or (code and not re.fullmatch(r'[0-9]{6}', code)):
        parser.error('Email/password required; optional authenticator code must contain six digits.')
    secrets = [password, code]
    report = {'timestampUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'origin': 'https://' + ACCESS_HOST, 'videoOrigin': 'https://' + VIDEO_HOST,
              'mode': 'read-only-access-token-video-compatibility', 'requests': []}
    status = 1
    try:
        status = shared['probe'](ACCESS_HOST, email, password, code, 'org:ifss-group',
                                 report, secrets, inspect_access=inspect_video)
    except (OSError, http.client.HTTPException) as error:
        report['result'] = f'Stopped: {type(error).__name__}. Raw exception omitted; no retry.'
    except (KeyboardInterrupt, EOFError):
        report['result'] = 'Cancelled. No further requests sent.'
        status = 130
    rendered = json.dumps(shared['redact'](report, secrets), indent=2) + '\n'
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
