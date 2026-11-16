import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AccessScreen } from '@/components/access-screen';
import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import type { DoorChoice, OrganisationChoice } from '@/services/latch';
import { useLatch } from '@/services/latch-context';
import { AccessError, safeAccessError } from '@/lib/access-error';
import { AppModal } from '@/components/app-modal';
import { AccessLayout, Spacing } from '@/constants/theme';
import { Brand } from '@/constants/branding';
import { useTheme } from '@/hooks/use-theme';

type DoorState =
  | { status: 'loading' }
  | { status: 'organisations'; choices: OrganisationChoice[] }
  | { status: 'doors'; choices: DoorChoice[] }
  | { status: 'ready'; door: DoorChoice; choices: DoorChoice[] }
  | { status: 'unavailable'; message: string };

function DoorIdentity({ door }: { door: DoorChoice }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
      <View accessible={false} importantForAccessibility="no-hide-descendants">
        {/* A compact identifier, never an indication of the physical door position. */}
        <Svg width={32} height={40} viewBox="0 0 100 120">
          <Rect x={21} y={8} width={58} height={102} rx={3} fill="none" stroke={theme.text} strokeWidth={5} />
          <Path d="M12 111H88" fill="none" stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
          <Path d="M61 61H70" fill="none" stroke={Brand.red} strokeWidth={6} strokeLinecap="round" />
          <Circle cx={70} cy={61} r={5} fill={Brand.red} />
        </Svg>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: Spacing.one }}>
        <ThemedText style={{ fontSize: 18, lineHeight: 26, fontWeight: '700' }}>{door.name}</ThemedText>
        <ThemedText selectable type="small" themeColor="textSecondary">
          {door.organisation} · {door.site} · {door.zone}
        </ThemedText>
      </View>
    </View>
  );
}

export default function DoorScreen() {
  const theme = useTheme();
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
    <AccessScreen headerActions={
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account"
        accessibilityState={{ expanded: confirmingSignOut, disabled: confirming || confirmingSignOut || pending }}
        disabled={confirming || confirmingSignOut || pending}
        onPress={() => setConfirmingSignOut(true)}
        style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: Spacing.three, borderRadius: 24,
          borderWidth: 1, borderColor: theme.modalOutline, flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
          opacity: confirming || confirmingSignOut || pending ? 0.5 : pressed ? 0.7 : 1 })}>
        <SymbolView name={{ ios: 'person', android: 'person', web: 'person' }} size={18} tintColor={theme.text} accessible={false} />
        <ThemedText type="smallBold">Account</ThemedText>
      </Pressable>
    }>
      {state.status === 'loading' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four }}>
        <ActivityIndicator color={theme.textSecondary} />
        <ThemedText>Checking access…</ThemedText>
      </View> : null}
      {state.status === 'unavailable' ? (
        <View style={{ gap: Spacing.three, paddingVertical: Spacing.four }}>
          <ThemedText type="subtitle" accessibilityRole="header">Access unavailable</ThemedText>
          <ThemedText selectable accessibilityRole="alert">COE Door access is unavailable. {state.message}</ThemedText>
        </View>
      ) : null}
      {state.status === 'organisations' ? <>
        <ThemedText type="subtitle" accessibilityRole="header">Choose an organisation</ThemedText>
        {state.choices.map((choice) => <ActionButton key={choice.key} label={choice.name} secondary
          disabled={confirmingSignOut} onPress={() => { setState({ status: 'loading' }); setOrganisationKey(choice.key); }} />)}
      </> : null}
      {state.status === 'doors' ? <>
        <ThemedText type="subtitle" accessibilityRole="header">Choose COE Door</ThemedText>
        <View style={{ borderWidth: 1, borderColor: theme.modalOutline, borderRadius: AccessLayout.controlRadius,
          overflow: 'hidden', backgroundColor: theme.backgroundElement }}>
          {state.choices.map((choice, index) => <Pressable key={choice.key}
            accessibilityRole="button"
            accessibilityLabel={`${choice.name} · ${choice.site} · ${choice.zone}`}
            accessibilityState={{ disabled: confirmingSignOut }}
            disabled={confirmingSignOut}
            onPress={() => setState({ status: 'ready', door: choice, choices: state.choices })}
            android_ripple={{ color: theme.backgroundSelected }}
            style={({ pressed }) => ({ padding: Spacing.three, gap: Spacing.three, flexDirection: 'row', alignItems: 'center',
              borderTopWidth: index === 0 ? 0 : 1, borderTopColor: theme.modalOutline,
              opacity: confirmingSignOut ? 0.5 : pressed ? 0.7 : 1 })}>
            <DoorIdentity door={choice} />
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={18} tintColor={theme.textSecondary} accessible={false} />
          </Pressable>)}
        </View>
      </> : null}
      {state.status === 'ready' ? (
        <>
          <ThemedText type="subtitle" accessibilityRole="header">Door access</ThemedText>
          <View style={{ padding: Spacing.three, gap: Spacing.three, backgroundColor: theme.backgroundElement,
            borderColor: theme.modalOutline, borderWidth: 1, borderRadius: AccessLayout.controlRadius }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.three }}>
              {/* Allow the action to wrap below the identity on narrow screens or with large text. */}
              <View style={{ flexGrow: 1, flexBasis: 160, minWidth: 0 }}>
                <DoorIdentity door={state.door} />
              </View>
              <Pressable accessibilityRole="button"
                accessibilityLabel={pending ? 'Requesting unlock…' : `Unlock ${state.door.name}`}
                accessibilityState={{ disabled: confirming || confirmingSignOut || unlockBlocked, busy: pending }}
                disabled={confirming || confirmingSignOut || unlockBlocked}
                onPress={confirmUnlock}
                android_ripple={{ color: theme.backgroundSelected }}
                style={({ pressed }) => ({ minHeight: 48, minWidth: 88, maxWidth: '100%', paddingHorizontal: Spacing.three,
                  paddingVertical: Spacing.two, alignItems: 'center', justifyContent: 'center',
                  borderRadius: AccessLayout.controlRadius, backgroundColor: theme.action,
                  opacity: confirming || confirmingSignOut || unlockBlocked ? 0.5 : pressed ? 0.8 : 1 })}>
                <ThemedText style={{ color: theme.actionText, fontWeight: '700' }}>{pending ? 'Requesting…' : 'Unlock'}</ThemedText>
              </Pressable>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: theme.modalOutline, paddingTop: Spacing.two,
              flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
              {pending ? <ActivityIndicator size="small" color={theme.action} /> : null}
              <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }} accessibilityLiveRegion="polite">
                {pending ? 'Request in progress' : unlockState.requiresAcknowledgement ? 'Previous result needs acknowledgement'
                  : coolingDown ? 'Please wait before another request' : simulated ? 'Ready for a simulated unlock' : 'Ready to request an unlock'}
              </ThemedText>
            </View>
          </View>
          {state.choices.length > 1 ? <ActionButton label="Change door" quiet disabled={confirming || confirmingSignOut || pending}
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
      {showOutcome ? <View style={{ gap: Spacing.two, padding: Spacing.three, borderLeftWidth: 3, borderLeftColor: theme.inputOutline }}>
        <ThemedText themeColor="textSecondary" type="small">Latest request</ThemedText>
        <ThemedText selectable accessibilityLiveRegion="polite">{outcome}</ThemedText>
      </View> : null}
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
      {state.status === 'ready' || state.status === 'unavailable' ? <ActionButton label="Refresh access" quiet={state.status === 'ready'} secondary
        disabled={confirming || confirmingSignOut || pending} onPress={() => {
          setState({ status: 'loading' }); toast.dismiss(); setRefresh((value) => value + 1);
        }} /> : null}
      {organisations.length > 1 && state.status !== 'organisations' ? <ActionButton label="Change organisation" quiet
        disabled={confirming || confirmingSignOut || pending || state.status === 'loading'} onPress={() => {
          toast.dismiss(); setState({ status: 'loading' }); setOrganisationKey(undefined); setRefresh((value) => value + 1);
        }} /> : null}
      <AppModal
        visible={confirmingSignOut}
        title="Your account"
        onClose={() => setConfirmingSignOut(false)}
        actions={<>
          <ActionButton label="Sign out" disabled={!confirmingSignOut || pending} onPress={() => {
            if (!confirmingSignOut || pending) return;
            setConfirmingSignOut(false);
            signOut();
          }} />
          <ActionButton label="Cancel" secondary onPress={() => setConfirmingSignOut(false)} />
        </>}>
        <ThemedText themeColor="textSecondary" type="small">Signed in as</ThemedText>
        <ThemedText selectable style={{ fontSize: 18, lineHeight: 26 }}>{session?.email}</ThemedText>
        <ThemedText>You’ll need to sign in again to request door access.</ThemedText>
      </AppModal>
    </AccessScreen>
  );
}
