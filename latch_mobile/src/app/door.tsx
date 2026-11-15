import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner-native';

import { AccessScreen } from '@/components/access-screen';
import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import type { DoorChoice, OrganisationChoice } from '@/services/latch';
import { useLatch } from '@/services/latch-context';
import { AccessError, safeAccessError } from '@/lib/access-error';
import { AppModal } from '@/components/app-modal';

type DoorState =
  | { status: 'loading' }
  | { status: 'organisations'; choices: OrganisationChoice[] }
  | { status: 'doors'; choices: DoorChoice[] }
  | { status: 'ready'; door: DoorChoice; choices: DoorChoice[] }
  | { status: 'unavailable'; message: string };

export default function DoorScreen() {
  const { app, session, signOut, unlockState, coolingDown, environment } = useLatch();
  const simulated = environment === 'demo';
  const [state, setState] = useState<DoorState>({ status: 'loading' });
  const [organisations, setOrganisations] = useState<OrganisationChoice[]>([]);
  const [organisationKey, setOrganisationKey] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const pending = unlockState.status === 'pending';
  const unlockBlocked = pending || coolingDown || unlockState.requiresAcknowledgement || acknowledging;
  const outcome = unlockState.status === 'accepted'
    ? simulated ? 'Simulated unlock accepted. No physical door was operated.' : 'Unlock request accepted. Door position has not been confirmed.'
    : unlockState.status === 'denied' ? 'The provider denied the unlock request.'
    : unlockState.status === 'unknown' ? "We couldn't confirm the result. Check before trying again."
    : unlockState.status === 'not-sent' ? 'Unlock request not sent. ' + (unlockState.error ? new AccessError(unlockState.error).message : '')
    : '';
  const showOutcome = outcome && (unlockState.status !== 'accepted' || (state.status === 'ready' &&
    state.door.organisation === unlockState.door?.organisation && state.door.site === unlockState.door.site &&
    state.door.zone === unlockState.door.zone && state.door.name === unlockState.door.name));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    function unavailable(error: unknown) {
      if (!active) return;
      const failure = safeAccessError(error);
      if (['expired', 'stale-operation'].includes(failure.code)) return;
      setState({ status: 'unavailable', message: failure.message });
      toast.error('COE access unavailable', { description: failure.message });
    }
    Promise.resolve().then(async () => {
      const choices = app.doors.discoverOrganisations();
      if (!active) return;
      setOrganisations(choices);
      if (!choices.length) throw new AccessError('access-denied');
      if (!organisationKey && choices.length > 1) {
        setState({ status: 'organisations', choices });
      } else {
        const doors = await app.doors.discoverDoors(organisationKey ?? choices[0].key);
        if (!active) return;
        if (!doors.length) throw new AccessError('entry-not-found');
        setState(doors.length === 1 ? { status: 'ready', door: doors[0], choices: doors } : { status: 'doors', choices: doors });
      }
    }).catch(unavailable);
    return () => { active = false; mounted.current = false; };
  }, [app, organisationKey, refresh]);

  async function requestUnlock(choiceKey: string) {
    try {
      const result = await app.doors.requestUnlock(choiceKey);
      if (!mounted.current) return;
      if (result.status === 'unknown') {
        toast.warning('Unlock result unconfirmed', { description: 'Check the door before trying again.' });
      } else if (result.status === 'denied') {
        toast.error('Unlock request denied', { description: 'The provider did not authorize the request.' });
      } else {
        toast.success(result.simulated ? 'Simulated unlock accepted' : 'Unlock request accepted', {
          description: result.simulated ? 'No physical door was operated.' : 'Door position has not been confirmed.',
        });
      }
    } catch (error) {
      if (!mounted.current || ['stale-operation', 'expired'].includes(safeAccessError(error).code)) return;
      const failure = safeAccessError(error);
      if (failure.code === 'access-changed' || failure.code === 'access-denied') {
        setState({ status: 'unavailable', message: failure.message });
        toast.error('COE access unavailable', { description: failure.message });
        return;
      }
      toast.error('Unlock request not sent', { description: failure.message });
    }
  }

  function confirmUnlock() {
    if (state.status !== 'ready' || confirming || confirmingSignOut || unlockBlocked) return;
    setConfirming(true);
  }

  return (
    <AccessScreen>
      {state.status === 'loading' ? <ThemedText>Checking access…</ThemedText> : null}
      {state.status === 'unavailable' ? (
        <ThemedText selectable accessibilityRole="alert">COE Door access is unavailable. {state.message}</ThemedText>
      ) : null}
      {state.status === 'organisations' ? <>
        <ThemedText type="subtitle" accessibilityRole="header">Choose an organisation</ThemedText>
        {state.choices.map((choice) => <ActionButton key={choice.key} label={choice.name} secondary
          disabled={confirmingSignOut} onPress={() => { setState({ status: 'loading' }); setOrganisationKey(choice.key); }} />)}
      </> : null}
      {state.status === 'doors' ? <>
        <ThemedText type="subtitle" accessibilityRole="header">Choose COE Door</ThemedText>
        <ThemedText themeColor="textSecondary">{state.choices[0].organisation}</ThemedText>
        {state.choices.map((choice) => <ActionButton key={choice.key} label={`${choice.name} · ${choice.site} · ${choice.zone}`}
          secondary disabled={confirmingSignOut} onPress={() => setState({ status: 'ready', door: choice, choices: state.choices })} />)}
      </> : null}
      {state.status === 'ready' ? (
        <>
          <ThemedText type="subtitle" accessibilityRole="header">{state.door.name}{simulated ? ' (simulated)' : ''}</ThemedText>
          <ThemedText selectable themeColor="textSecondary">
            {state.door.organisation} · {state.door.site} · {state.door.zone}
          </ThemedText>
          <ThemedText>{pending ? 'Request in progress' : unlockState.requiresAcknowledgement ? 'Previous result needs acknowledgement'
            : coolingDown ? 'Please wait before another request' : simulated ? 'Ready to request a simulated unlock' : 'Ready to request an unlock'}</ThemedText>
          <ActionButton
            label={pending ? 'Requesting unlock…' : `Unlock ${state.door.name}`}
            disabled={confirming || confirmingSignOut || unlockBlocked}
            onPress={confirmUnlock}
          />
          {state.choices.length > 1 ? <ActionButton label="Change door" secondary disabled={confirming || confirmingSignOut || pending}
            onPress={() => { toast.dismiss(); setState({ status: 'doors', choices: state.choices }); }} /> : null}
          <AppModal
            visible={confirming}
            title={`Unlock ${state.door.name}?`}
            onClose={() => setConfirming(false)}
            actions={<>
              <ActionButton label="Unlock" disabled={!confirming || unlockBlocked} onPress={() => {
                if (!confirming || unlockBlocked) return;
                setConfirming(false);
                void requestUnlock(state.door.key);
              }} />
              <ActionButton label="Cancel" secondary onPress={() => setConfirming(false)} />
            </>}>
            <ThemedText themeColor="textSecondary">{state.door.organisation} · {state.door.site} · {state.door.zone}</ThemedText>
            <ThemedText>{simulated ? 'Demo only. No physical door will be operated.' : 'This requests a real door unlock using your Alta permissions.'}</ThemedText>
          </AppModal>
        </>
      ) : null}
      {showOutcome ? <ThemedText selectable accessibilityLiveRegion="polite">{outcome}</ThemedText> : null}
      {unlockState.status === 'unknown' && unlockState.door ? <>
        <ThemedText selectable themeColor="textSecondary">
          Previous request: {unlockState.door.name} · {unlockState.door.organisation} · {unlockState.door.site} · {unlockState.door.zone}
        </ThemedText>
        {unlockState.requiresAcknowledgement ? <>
          <ThemedText>Check the door before acknowledging. This will not send another unlock request.</ThemedText>
          <ActionButton label={acknowledging ? 'Saving acknowledgement…' : 'Acknowledge result'} secondary
            disabled={acknowledging || pending || confirmingSignOut} onPress={async () => {
              if (acknowledging) return;
              setAcknowledging(true);
              try { await app.doors.acknowledgeUnknown(); toast.dismiss(); }
              catch (error) {
                if (mounted.current && !['expired', 'stale-operation'].includes(safeAccessError(error).code))
                  toast.error('Acknowledgement not saved', { description: safeAccessError(error).message });
              } finally { if (mounted.current) setAcknowledging(false); }
            }} />
        </> : <ThemedText>Acknowledgement saved. A new request still needs confirmation.</ThemedText>}
      </> : null}
      {state.status === 'ready' || state.status === 'unavailable' ? <ActionButton label="Refresh access" secondary
        disabled={confirming || confirmingSignOut || pending} onPress={() => {
          setState({ status: 'loading' }); toast.dismiss(); setRefresh((value) => value + 1);
        }} /> : null}
      {organisations.length > 1 && state.status !== 'organisations' ? <ActionButton label="Change organisation" secondary
        disabled={confirming || confirmingSignOut || pending || state.status === 'loading'} onPress={() => {
          toast.dismiss(); setState({ status: 'loading' }); setOrganisationKey(undefined); setRefresh((value) => value + 1);
        }} /> : null}
      <ThemedText selectable>{session?.email}</ThemedText>
      <ActionButton label="Sign out" secondary disabled={confirming || confirmingSignOut || pending}
        onPress={() => setConfirmingSignOut(true)} />
      <AppModal
        visible={confirmingSignOut}
        title="Sign out of Latch?"
        onClose={() => setConfirmingSignOut(false)}
        actions={<>
          <ActionButton label="Sign out" disabled={!confirmingSignOut || pending} onPress={() => {
            if (!confirmingSignOut || pending) return;
            setConfirmingSignOut(false);
            signOut();
          }} />
          <ActionButton label="Cancel" secondary onPress={() => setConfirmingSignOut(false)} />
        </>}>
        <ThemedText>You’ll need to sign in again to request door access.</ThemedText>
      </AppModal>
    </AccessScreen>
  );
}
