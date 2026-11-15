import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner-native';

import { AccessScreen } from '@/components/access-screen';
import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import type { DoorChoice } from '@/services/latch';
import { useLatch } from '@/services/latch-context';
import { safeAccessError } from '@/lib/access-error';
import { AppModal } from '@/components/app-modal';

type DoorState =
  | { status: 'loading' }
  | { status: 'ready'; door: DoorChoice }
  | { status: 'unavailable' };

export default function DoorScreen() {
  const { app, session, signOut } = useLatch();
  const [state, setState] = useState<DoorState>({ status: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    function unavailable() {
      if (!active) return;
      setState({ status: 'unavailable' });
      toast.error('COE access unavailable', { description: 'Door access could not be prepared for this session.' });
    }
    app.doors.discoverDoors().then(
      ([door]) => {
        if (!active) return;
        if (door) setState({ status: 'ready', door });
        else unavailable();
      },
      unavailable,
    );
    return () => { active = false; mounted.current = false; };
  }, [app]);

  async function requestUnlock(choiceKey: string) {
    setPending(true);
    setOutcome('');
    try {
      const result = await app.doors.requestUnlock(choiceKey);
      if (!mounted.current) return;
      setOutcome(result.simulated
        ? 'Simulated unlock accepted. No physical door was operated.'
        : 'Unlock request accepted. Door position has not been confirmed.');
      toast.success(result.simulated ? 'Simulated unlock accepted' : 'Unlock request accepted', {
        description: result.simulated ? 'No physical door was operated.' : 'Door position has not been confirmed.',
      });
    } catch (error) {
      if (!mounted.current || ['stale-operation', 'expired'].includes(safeAccessError(error).code)) return;
      setOutcome("We couldn't confirm the result. Check before trying again.");
      toast.warning('Unlock result unconfirmed', { description: 'Check the door before trying again.' });
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  function confirmUnlock() {
    if (state.status !== 'ready' || confirming || pending) return;
    setConfirming(true);
  }

  return (
    <AccessScreen>
      {state.status === 'loading' ? <ThemedText>Checking access…</ThemedText> : null}
      {state.status === 'unavailable' ? (
        <ThemedText accessibilityRole="alert">COE Door access is unavailable.</ThemedText>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <ThemedText type="subtitle" accessibilityRole="header">{state.door.name} (simulated)</ThemedText>
          <ThemedText selectable themeColor="textSecondary">
            {state.door.organisation} · {state.door.site} · {state.door.zone}
          </ThemedText>
          <ThemedText>{pending ? 'Request in progress' : 'Ready to request a simulated unlock'}</ThemedText>
          <ActionButton
            label={pending ? 'Requesting unlock…' : `Unlock ${state.door.name}`}
            disabled={confirming || pending}
            onPress={confirmUnlock}
          />
          {outcome ? <ThemedText selectable accessibilityLiveRegion="polite">{outcome}</ThemedText> : null}
          <AppModal
            visible={confirming}
            title={`Unlock ${state.door.name}?`}
            onClose={() => setConfirming(false)}
            actions={<>
              <ActionButton label="Unlock" disabled={!confirming || pending} onPress={() => {
                if (!confirming || pending) return;
                setConfirming(false);
                void requestUnlock(state.door.key);
              }} />
              <ActionButton label="Cancel" secondary onPress={() => setConfirming(false)} />
            </>}>
            <ThemedText themeColor="textSecondary">{state.door.organisation} · {state.door.site} · {state.door.zone}</ThemedText>
            <ThemedText>Demo only. No physical door will be operated.</ThemedText>
          </AppModal>
        </>
      ) : null}
      <ThemedText selectable>{session?.email}</ThemedText>
      <ActionButton label="Sign out" secondary disabled={confirming || pending} onPress={signOut} />
    </AccessScreen>
  );
}
