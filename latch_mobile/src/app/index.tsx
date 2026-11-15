import { useState } from 'react';
import { useIsFocused } from 'expo-router/react-navigation';
import { SymbolView } from 'expo-symbols';
import { Pressable, TextInput, View } from 'react-native';
import { toast } from 'sonner-native';

import { AccessScreen } from '@/components/access-screen';
import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { AccessLayout, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLatch } from '@/services/latch-context';
import { AccessError, safeAccessError } from '@/lib/access-error';
import { sendMonitoringVerification } from '@/monitoring/verification';

export default function HomeScreen() {
  const focused = useIsFocused();
  const theme = useTheme();
  const { signIn, signOut, authState, retrySession, environment } = useLatch();
  const simulated = environment === 'demo';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verification, setVerification] = useState('');
  const inputStyle = {
    color: theme.text,
    backgroundColor: theme.backgroundElement,
    borderColor: theme.inputOutline,
    borderWidth: 1,
    borderRadius: AccessLayout.controlRadius,
    minHeight: 56,
    padding: Spacing.three,
    fontSize: 16,
    fontFamily: Fonts.sans,
  };

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    const input = { email: email.trim(), password, ...(mfaRequired ? { totpCode } : {}) };
    setPassword('');
    setTotpCode('');
    setPasswordVisible(false);
    try {
      await signIn(input);
    } catch (error) {
      const failure = safeAccessError(error);
      if (failure.code === 'stale-operation') return;
      setError(simulated && failure.code === 'invalid-credentials' ? 'Sign-in failed. Check the demo account details.' : failure.message);
      if (failure.code === 'mfa-required' || failure.code === 'mfa-invalid') {
        setMfaRequired(true);
        if (failure.code === 'mfa-required') toast.info('Authenticator code required');
        else toast.error('Code not accepted');
      } else {
        toast.error('Unable to sign in');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessScreen backdrop={focused ? 'animated' : 'static'}>
      <View style={{ gap: Spacing.two, paddingTop: Spacing.three, paddingBottom: Spacing.two }}>
        <ThemedText themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 18, letterSpacing: 2, fontWeight: '500' }}>BUILDING ACCESS</ThemedText>
        <ThemedText accessibilityRole="header" style={{ fontSize: AccessLayout.titleSize, lineHeight: AccessLayout.titleLineHeight, fontWeight: '700', letterSpacing: -1 }}>Sign in to Latch</ThemedText>
        <ThemedText themeColor="textSecondary">{simulated ? 'Try Latch with a demo account.' : 'Use your Avigilon Alta account.'}</ThemedText>
      </View>
      <View style={{ gap: Spacing.four }}>
        <View style={{ gap: Spacing.two }}>
          <ThemedText>Email</ThemedText>
          <TextInput
            accessibilityLabel="Email"
            value={email}
            onChangeText={(value) => { setEmail(value); if (simulated) setMfaRequired(false); setTotpCode(''); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            editable={!busy}
            style={inputStyle}
          />
        </View>
        <View style={{ gap: Spacing.two }}>
          <ThemedText>Password</ThemedText>
          <View>
            <TextInput
              accessibilityLabel="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              editable={!busy}
              style={[inputStyle, { paddingRight: Spacing.six }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              accessibilityState={{ disabled: busy, selected: passwordVisible }}
              disabled={busy}
              onPress={() => setPasswordVisible((visible) => !visible)}
              android_ripple={{ color: theme.backgroundSelected }}
              style={({ pressed }) => ({
                position: 'absolute',
                top: Spacing.one,
                bottom: Spacing.one,
                right: Spacing.one,
                width: 48,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: Spacing.two,
                opacity: busy ? 0.5 : pressed ? 0.7 : 1,
              })}>
              <SymbolView
                name={{
                  ios: passwordVisible ? 'eye.slash' : 'eye',
                  android: passwordVisible ? 'visibility_off' : 'visibility',
                  web: passwordVisible ? 'visibility_off' : 'visibility',
                }}
                size={24}
                tintColor={theme.textSecondary}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              />
            </Pressable>
          </View>
        </View>
        {mfaRequired ? (
          <View style={{ gap: Spacing.two }}>
            <ThemedText>Authenticator code</ThemedText>
            <TextInput
              accessibilityLabel="Authenticator code"
              value={totpCode}
              onChangeText={(value) => setTotpCode(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              editable={!busy}
              style={inputStyle}
            />
          </View>
        ) : null}
        {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
        {!error && authState.error ? <ThemedText accessibilityRole="alert">{new AccessError(authState.error).message}</ThemedText> : null}
        {['storage', 'unavailable'].includes(authState.error ?? '') ? <ActionButton label="Retry session check" secondary disabled={busy} onPress={retrySession} /> : null}
        <ActionButton
          label={busy ? 'Signing in…' : 'Sign in'}
          disabled={busy || !email.trim() || !password || (mfaRequired && totpCode.length !== 6)}
          onPress={() => void submit()}
        />
        {!simulated && !mfaRequired ? <ActionButton label="Use authenticator code" quiet disabled={busy}
          onPress={() => setMfaRequired(true)} /> : null}
        {mfaRequired ? <ActionButton label="Cancel sign-in" secondary onPress={() => {
          toast.dismiss();
          signOut();
          setPassword(''); setTotpCode(''); setPasswordVisible(false); setMfaRequired(false); setError('');
        }} /> : null}
      </View>
      {simulated ? <View style={{ gap: Spacing.two, borderTopWidth: 1, borderTopColor: theme.modalOutline, paddingTop: Spacing.four }}>
        <ThemedText>Use a demo account. No physical door will be operated.</ThemedText>
        <ThemedText selectable themeColor="textSecondary" style={{ fontSize: 14, lineHeight: 22 }}>
          Email: demo@latch.example{'\n'}Password: latch-demo-only{'\n'}
          MFA demo: mfa@latch.example · Code: 123456{'\n'}
          Organisation and door choices: multi@latch.example
        </ThemedText>
      </View> : <ThemedText themeColor="textSecondary" type="small">SSO-only accounts are not supported.</ThemedText>}
      {__DEV__ && simulated && process.env.EXPO_PUBLIC_SENTRY_VERIFY === '1' ? <>
        <ActionButton label="Send Sentry test error" secondary disabled={busy} onPress={async () => {
          try { setVerification(`${await sendMonitoringVerification()} queued. Receipt still needs confirmation in Sentry.`); }
          catch { setVerification('The test error could not be queued.'); }
        }} />
        {verification ? <ThemedText selectable accessibilityLiveRegion="polite">{verification}</ThemedText> : null}
      </> : null}
    </AccessScreen>
  );
}
