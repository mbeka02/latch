#!/usr/bin/env python3
"""Read-only Alta access investigation: login, profile, entries, keys and assignments."""

import argparse
from concurrent.futures import ThreadPoolExecutor
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


def credential_user_metadata(user):
    if not isinstance(user, dict):
        return {'valueType': type(user).__name__}
    result = {key: user[key] for key in ('id', 'status', 'hasRemoteUnlock') if key in user}
    result['groupsPresent'] = 'groups' in user
    if isinstance(user.get('groups'), list):
        groups = []
        for group in user['groups']:
            if not isinstance(group, dict):
                groups.append({'invalidGroup': True})
                continue
            value = {key: group[key] for key in ('id', 'name') if key in group}
            value['intercomProfilesPresent'] = 'opvideoIntercomProfiles' in group
            profiles = group.get('opvideoIntercomProfiles')
            if isinstance(profiles, list):
                value['intercomProfiles'] = []
                for profile in profiles:
                    if not isinstance(profile, dict):
                        continue
                    row = {key: profile[key] for key in ('id', 'name', 'opvideoIntercomProfileTypeId') if key in profile}
                    row['intercomsPresent'] = 'opvideoIntercoms' in profile
                    intercoms = profile.get('opvideoIntercoms')
                    if isinstance(intercoms, list):
                        row['intercoms'] = [{key: intercom[key] for key in ('id', 'name') if key in intercom}
                                            for intercom in intercoms if isinstance(intercom, dict)]
                    value['intercomProfiles'].append(row)
            groups.append(value)
        result['groups'] = groups
    elif 'groups' in user:
        result['groupsValueType'] = type(user['groups']).__name__
    return result


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
            if isinstance(item.get('credentialType'), dict) else None,
            'userAssociationPresent': 'user' in item,
            **({'userAssociation': credential_user_metadata(item['user'])} if 'user' in item else {})}


def paged(host, token, base, resource, report, max_pages=101, item_transform=None):
    items, seen = [], set()
    for _ in range(max_pages):
        offset = len(items)
        if offset > 10_000:
            break
        sort = ('zoneShare.zone.name' if resource == 'zoneUsers' else
                'name' if resource in ('acus', 'entries', 'readers', 'relays', 'zones', 'wirelessLocks', 'wirelessLockGateways', 'wirelessGateways') else 'id')
        record, body = request(host, 'GET', f'{base}/{resource}?limit=100&offset={offset}&sort={sort}&order=asc', token=token)
        if item_transform is not None and record['status'] == 200:
            record['body'] = ({**{key: body[key] for key in ('totalCount', 'filteredCount') if key in body},
                               'data': [item_transform(item) for item in body['data']]}
                              if isinstance(body, dict) and isinstance(body.get('data'), list)
                              else '<OMITTED: malformed hardware response>')
            record['hardwarePayloadPolicy'] = 'Inventory and entry references only; authentication keys, configuration and location omitted.'
        report['requests'].append(record)
        if resource == 'credentials' and isinstance(body, dict):
            record['body'] = ({**body, 'data': [credential_metadata(item) for item in body['data']]}
                              if isinstance(body.get('data'), list) else '<OMITTED: malformed credential response>')
            record['credentialPayloadPolicy'] = 'Type, IDs, validity and optional user/intercom associations retained; credential secrets and contact details omitted.'
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
            items.append(item_transform(item) if item_transform is not None else
                         credential_metadata(item) if resource == 'credentials' else item)
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


def inspect_controllers(host, token, associations, report):
    report['controllerChecks'] = []
    for org_id, user_id in associations:
        result = paged(host, token, f'/orgs/{org_id}/users/{user_id}', 'acus', report)
        references = []
        for controller in result['items']:
            shadow = controller.get('shadow')
            state = shadow.get('state') if isinstance(shadow, dict) else None
            reported = state.get('reported') if isinstance(state, dict) else None
            entries = reported.get('entries') if isinstance(reported, dict) else None
            if isinstance(entries, dict):
                references.extend({'controllerId': controller['id'], 'controllerName': controller.get('name'),
                                   'entryIdReference': entry_id}
                                  for entry_id in entries if re.fullmatch(r'[0-9]+', entry_id))
        report['controllerChecks'].append({'orgId': org_id, 'userId': user_id, **result,
                                          'reportedEntryReferences': references})
    report['result'] = ('Own-user controller inventory recorded. Reported entry references are controller status metadata, '
                        'not verified personal unlock permissions or a COE mapping. No commands sent.')
    return 0 if all(row['complete'] for row in report['controllerChecks']) else 1


def inspect_alternatives(host, token, associations, report):
    status = inspect_controllers(host, token, associations, report)
    report['activityChecks'] = []
    fields = ('time', 'timeIsoString', 'sourceName', 'category', 'subCategory',
              'acuId', 'acuName', 'entryId', 'entryName', 'entries', 'zoneId', 'zoneName',
              'siteId', 'siteName', 'readerId', 'readerName', 'requestType', 'result',
              'resultDescription', 'deniedReason')
    for org_id, user_id in associations:
        path = f'/orgs/{org_id}/users/{user_id}/reports/activity?limit=20&offset=0&sort=time&order=desc'
        record, body = request(host, 'GET', path, token=token)
        valid = (record['status'] == 200 and isinstance(body, dict) and
                 isinstance(body.get('data'), list) and len(body['data']) <= 20 and
                 all(isinstance(row, dict) for row in body['data']))
        if valid:
            sanitized = [{key: row[key] for key in fields if key in row} for row in body['data']]
            for event in sanitized:
                if 'entries' in event:
                    event['entries'] = ([{key: entry[key] for key in ('id', 'name') if key in entry}
                                         for entry in event['entries'] if isinstance(entry, dict)]
                                        if isinstance(event['entries'], list) else '<INVALID ENTRIES>')
            record['body'] = {key: body[key] for key in ('totalCount', 'filteredCount') if key in body}
            record['body']['data'] = sanitized
        elif record['status'] == 200:
            record['body'] = '<OMITTED: malformed activity response>'
        record['activityPayloadPolicy'] = 'At most 20 recent own-user events; credential details, user contact and location omitted.'
        report['requests'].append(record)
        report['activityChecks'].append({'orgId': org_id, 'userId': user_id,
                                         'status': record['status'], 'responseValid': valid,
                                         'pageLimit': 20, 'historyComplete': False})
        if not valid:
            status = 1
    report['result'] = ('Alternative discovery recorded: own-user controllers and at most 20 recent own-user activity events. '
                        'Historical/controller entry references do not prove current unlock permission. No commands sent.')
    return status


def wireless_metadata(item):
    if not isinstance(item, dict):
        return {'invalidHardware': True}
    fields = ('id', 'name', 'manufacturer', 'model', 'status', 'isLive', 'isOffline',
              'acuId', 'virtualAcuId', 'wirelessGatewayId', 'wirelessLockGatewayId',
              'wirelessLockProviderId', 'wirelessLockCount')
    result = {key: item[key] for key in fields if key in item}
    entry = item.get('entry')
    if isinstance(entry, dict):
        result['entry'] = {key: entry[key] for key in ('id', 'name') if key in entry}
        zone = entry.get('zone')
        if isinstance(zone, dict):
            result['entry']['zone'] = {key: zone[key] for key in ('id', 'name') if key in zone}
            site = zone.get('site')
            if isinstance(site, dict):
                result['entry']['zone']['site'] = {key: site[key] for key in ('id', 'name') if key in site}
    return result


def entry_metadata(item):
    if not isinstance(item, dict):
        return {'invalidEntry': True}
    result = {key: item[key] for key in ('id', 'name') if key in item}
    zone = item.get('zone')
    if isinstance(zone, dict):
        result['zone'] = {key: zone[key] for key in ('id', 'name') if key in zone}
        site = zone.get('site')
        if isinstance(site, dict):
            result['zone']['site'] = {key: site[key] for key in ('id', 'name') if key in site}
    return result


def hardware_entry_metadata(item):
    """Keep target mappings, without serials, wiring configuration or location."""
    if not isinstance(item, dict):
        return {'invalidHardware': True}
    result = {key: item[key] for key in ('id', 'name') if key in item}
    for field in ('org', 'ownedByOrg', 'site'):
        value = item.get(field)
        if isinstance(value, dict):
            result[field] = {key: value[key] for key in ('id', 'name') if key in value}
    result['entriesPresent'] = 'entries' in item
    entries = item.get('entries')
    if isinstance(entries, list):
        result['entries'] = [entry_metadata(entry) for entry in entries]
    elif 'entries' in item:
        result['entriesValueType'] = type(entries).__name__
    return result


def inspect_hardware_discovery(host, token, associations, report):
    report['hardwareDiscoveryChecks'] = []
    for org_id in dict.fromkeys(org_id for org_id, _ in associations):
        def read_resource(resource):
            local = {'requests': []}
            try:
                result = paged(host, token, f'/orgs/{org_id}', resource, local,
                               max_pages=6, item_transform=hardware_entry_metadata)
            except (OSError, http.client.HTTPException) as error:
                result = {'complete': False, 'items': [], 'reason': type(error).__name__ + '; no retry.'}
            return resource, local, result

        with ThreadPoolExecutor(max_workers=3) as pool:
            for resource, local, result in pool.map(read_resource, ('readers', 'relays', 'zones')):
                report['requests'].extend(local['requests'])
                references = [
                    {'sourceId': item.get('id'), 'sourceName': item.get('name'), **entry}
                    for item in result['items'] for entry in item.get('entries', [])]
                report['hardwareDiscoveryChecks'].append(
                    {'orgId': org_id, 'resource': resource, **result, 'entryReferences': references})
    report['result'] = ('Organization readers, relays and zones checked independently, bounded to six pages of 100 each. '
                        'Missing entries fields are distinct from empty arrays. Denied/incomplete reads are not empty inventories. '
                        'Entry references are unfiltered and do not establish personal unlock permission. No commands sent.')
    return 0 if all(row['complete'] for row in report['hardwareDiscoveryChecks']) else 1


def inspect_wireless(host, token, associations, report):
    report['wirelessChecks'] = []
    resources = ('wirelessLocks', 'wirelessLockGateways', 'wirelessGateways', 'entries')
    # Inventory belongs to the org, so do not repeat it for multiple own-user associations.
    for org_id in dict.fromkeys(org_id for org_id, _ in associations):
        def read_resource(resource):
            local = {'requests': []}
            try:
                result = paged(host, token, f'/orgs/{org_id}', resource, local,
                               max_pages=6, item_transform=entry_metadata if resource == 'entries' else wireless_metadata)
            except (OSError, http.client.HTTPException) as error:
                result = {'complete': False, 'items': [], 'reason': type(error).__name__ + '; no retry.'}
            return resource, local, result

        # Independent reads share only the in-memory token; each has its own HTTPS connection/report.
        with ThreadPoolExecutor(max_workers=4) as pool:
            for resource, local, result in pool.map(read_resource, resources):
                report['requests'].extend(local['requests'])
                report['wirelessChecks'].append({'orgId': org_id, 'resource': resource, **result})
    report['result'] = ('Wireless and organization-entry inventory comparison finished. Each resource is bounded to six pages of 100, '
                        'with incomplete reads explicit. Denials are not empty inventories. '
                        'Entry references do not prove personal unlock permission. No commands sent.')
    return 0 if all(row['complete'] for row in report['wirelessChecks']) else 1


def inspect_discovery_comparison(host, token, associations, report):
    report['discoveryChecks'] = []
    inventories = {}
    for org_id, user_id in associations:
        path = f'/orgs/{org_id}/users/{user_id}/entries'
        record, body = request(host, 'GET', path, token=token)
        report['requests'].append(record)
        personal = (shared['describe_entries'](body) if record['status'] == 200 else
                    {'responseValid': False, 'problems': [f'HTTP {record["status"]}']})
        if org_id not in inventories:
            inventories[org_id] = paged(host, token, f'/orgs/{org_id}', 'entries', report,
                                        max_pages=6, item_transform=entry_metadata)
        organization = inventories[org_id]
        names = [{'id': item.get('id'), 'name': item.get('name'),
                  'exactAppNameMatch': isinstance(item.get('name'), str) and item['name'].strip().lower() == 'coe door'}
                 for item in organization['items']]
        report['discoveryChecks'].append({'orgId': org_id, 'userId': user_id,
                                          'personalEntries': personal,
                                          'organizationInventory': organization,
                                          'organizationEntryNames': names})
    report['result'] = ('Discovery comparison recorded: personal response validation and exact COE Door matching, '
                        'versus bounded organization inventory with returned names. Same login/token throughout. '
                        'Admin inventory visibility is not personal unlock permission. Credentials and unlocks not tested.')
    return 0 if all(row['personalEntries']['responseValid'] and row['organizationInventory']['complete']
                    for row in report['discoveryChecks']) else 1


def inspect_credential_associations(host, token, associations, report):
    report['credentialAssociationChecks'] = []
    for org_id, user_id in associations:
        base = f'/orgs/{org_id}/users/{user_id}'
        inventory = paged(host, token, base, 'credentials', report)
        check = {'orgId': org_id, 'userId': user_id, 'inventory': inventory}
        report['credentialAssociationChecks'].append(check)
        keys = [item for item in inventory['items'] if item.get('variantNames') == ['cloudKey']]
        if not inventory['complete'] or len(keys) != 1:
            check['note'] = 'No single Cloud Key identified in a complete own-user inventory; detail read skipped.'
            continue
        credential_id = int(keys[0]['id'])
        record, body = request(host, 'GET', f'{base}/credentials/{credential_id}', token=token)
        if record['status'] == 200:
            value = body.get('data') if isinstance(body, dict) else None
            record['body'] = {'data': credential_metadata(value)}
            check['detailMatchesRequestedCredential'] = isinstance(value, dict) and value.get('id') == credential_id
            check['detail'] = record['body']['data']
        check['detailStatus'] = record['status']
        report['requests'].append(record)
    report['result'] = ('Own Cloud Key association metadata recorded. Missing optional fields are not an empty assignment '
                        'or a permission verdict. Intercom IDs are not entry IDs. No provisioning, token creation or unlocks sent.')
    return 0 if all(row.get('detailStatus') == 200 and row.get('detailMatchesRequestedCredential')
                    for row in report['credentialAssociationChecks']) else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True, help='New redacted local report, permissions 0600.')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--compare-mobile-login', action='store_true',
                      help='Read-only comparison: fresh login without forMobileLogin versus with true. No assumed fix.')
    mode.add_argument('--zone-assignments-only', action='store_true',
                      help='Only login, profile validation and user zone-assignment records; use the documented nested sort.')
    mode.add_argument('--alternative-discovery-only', action='store_true',
                      help='Only login/profile, own-user controllers and the latest 20 own-user entry activity records.')
    mode.add_argument('--wireless-only', action='store_true',
                      help='One login/profile check, then three wireless inventories and organization entries in parallel; no unlocks.')
    mode.add_argument('--hardware-discovery-only', action='store_true',
                      help='One login/profile check, then organization readers, relays and zones with entry references; no unlocks.')
    mode.add_argument('--discovery-comparison-only', action='store_true',
                      help='Compare app personal-entry discovery and exact name matching with paged organization entries.')
    mode.add_argument('--credential-associations-only', action='store_true',
                      help='Read existing Cloud Key metadata and one detail response, retaining optional intercom associations.')
    args = parser.parse_args()
    if not sys.stdin.isatty():
        parser.error('Run interactively; do not supply credentials through flags or pipes.')
    if args.output.exists():
        parser.error('Output exists. Choose another filename. No request sent.')
    print('EU API, org:ifss-group. Fresh login and read-only access diagnostics.')
    if args.compare_mobile_login:
        print('Controlled comparison: two logins, changing only forMobileLogin from omitted to true.')
    if args.hardware_discovery_only:
        print('Hardware discovery: readers, relays and organization zones in parallel, up to six pages of 100 each; no name filters.')
    elif args.credential_associations_only:
        print('Association mode: existing own-user credential inventory and one Cloud Key detail. Credential secrets omitted.')
    elif args.discovery_comparison_only:
        print('Discovery comparison: personal entries plus organization entries, preserving names and app decoder/match results.')
    elif args.wireless_only:
        print('Wireless + entries mode: four independent inventory reads in parallel, up to six pages each. Hardware secrets omitted.')
    elif args.alternative_discovery_only:
        print('Targeted mode: own-user controllers and latest 20 activity events. Credential details and location omitted.')
    elif args.zone_assignments_only:
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
            inspector = (inspect_hardware_discovery if args.hardware_discovery_only else
                         inspect_credential_associations if args.credential_associations_only else
                         inspect_discovery_comparison if args.discovery_comparison_only else
                         inspect_wireless if args.wireless_only else
                         inspect_alternatives if args.alternative_discovery_only else
                         inspect_zone_records if args.zone_assignments_only else inspect_access)
            status = shared['probe']('api.eu.openpath.com', email, password, code, 'org:ifss-group',
                                     report, secrets, inspect_access=inspector)
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
