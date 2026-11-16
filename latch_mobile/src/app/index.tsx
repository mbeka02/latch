import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { useIsFocused } from 'expo-router/react-navigation';
import { SymbolView } from 'expo-symbols';
import { BackHandler, Pressable, TextInput, View } from 'react-native';
import { toast } from 'sonner-native';

import { AccessScreen } from '@/components/access-screen';
import { ActionButton } from '@/components/action-button';
import { InlineMessage } from '@/components/inline-message';
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
  const [verifyingMonitoring, setVerifyingMonitoring] = useState(false);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const submission = useRef(0);
  useEffect(() => {
    if (!focused || !mfaRequired) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) { setMfaRequired(false); setTotpCode(''); setError(''); toast.dismiss(); }
      return true;
    });
    return () => subscription.remove();
  }, [focused, mfaRequired, busy]);
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
    if (busy || !email.trim() || !password || (mfaRequired && totpCode.length !== 6)) return;
    const attempt = ++submission.current;
    setBusy(true);
    setError('');
    const input = { email: email.trim(), password, ...(mfaRequired ? { totpCode } : {}) };
    setPasswordVisible(false);
    try {
      await signIn(input);
      if (attempt !== submission.current) return;
      setPassword('');
      setTotpCode('');
    } catch (error) {
      if (attempt !== submission.current) return;
      const failure = safeAccessError(error);
      if (failure.code === 'stale-operation') return;
      setError(failure.code === 'mfa-required' ? '' : simulated && failure.code === 'invalid-credentials' ? 'Sign-in failed. Check the demo account details.' : failure.message);
      if (failure.code === 'mfa-required' || failure.code === 'mfa-invalid') {
        setMfaRequired(true);
        setTotpCode('');
        if (failure.code === 'mfa-required') toast.info('Authenticator code required');
        else toast.error('Code not accepted');
      } else {
        toast.error('Unable to sign in');
      }
    } finally {
      if (attempt === submission.current) setBusy(false);
    }
  }

  return (
    <AccessScreen backdrop={focused ? 'animated' : 'static'}>
      <View style={{ gap: Spacing.two, paddingTop: Spacing.three, paddingBottom: Spacing.two }}>
        <ThemedText themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 18, letterSpacing: 2, fontWeight: '500' }}>BUILDING ACCESS</ThemedText>
        <ThemedText accessibilityRole="header" style={{ fontSize: AccessLayout.titleSize, lineHeight: AccessLayout.titleLineHeight, fontWeight: '700', letterSpacing: -1 }}>{mfaRequired ? 'Verify your sign-in' : 'Sign in to Latch'}</ThemedText>
        <ThemedText themeColor="textSecondary">{mfaRequired ? 'Enter the six-digit code from your authenticator app to finish signing in.' : simulated ? 'Try Latch with a demo account.' : 'Use your Avigilon Alta account.'}</ThemedText>
        {mfaRequired ? <ThemedText selectable type="small">{email.trim()}</ThemedText> : null}
      </View>
      <View style={{ gap: Spacing.four }}>
        {!mfaRequired ? <>
          <View style={{ gap: Spacing.two }}>
            <ThemedText>Email</ThemedText>
            <TextInput
              accessibilityLabel="Email"
              value={email}
              onChangeText={(value) => { setEmail(value); setTotpCode(''); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordInput.current?.focus()}
              editable={!busy}
              style={inputStyle}
            />
          </View>
          <View style={{ gap: Spacing.two }}>
            <ThemedText>Password</ThemedText>
            <View>
              <TextInput
                ref={passwordInput}
                accessibilityLabel="Password"
                value={password}
                onChangeText={(value) => { setPassword(value); setError(''); }}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
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
        </> : null}
        {mfaRequired ? (
          <View style={{ gap: Spacing.two }}>
            <ThemedText>Authenticator code</ThemedText>
            <TextInput
              accessibilityLabel="Authenticator code"
              value={totpCode}
              onChangeText={(value) => { setTotpCode(value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              maxLength={6}
              editable={!busy}
              style={[inputStyle, { fontSize: 24, textAlign: 'center', letterSpacing: 8, fontVariant: ['tabular-nums'] }]}
            />
            <ThemedText type="small" themeColor="textSecondary">Use the current code. Codes refresh regularly.</ThemedText>
          </View>
        ) : null}
        {error ? <InlineMessage>{error}</InlineMessage> : null}
        {!error && authState.error && !['mfa-required', 'mfa-invalid', 'invalid-credentials'].includes(authState.error) ? <InlineMessage>{new AccessError(authState.error).message}</InlineMessage> : null}
        {['storage', 'unavailable'].includes(authState.error ?? '') ? <ActionButton label="Retry session check" secondary disabled={busy} onPress={retrySession} /> : null}
        <ActionButton
          label={busy ? mfaRequired ? 'Verifying…' : 'Signing in…' : mfaRequired ? 'Verify and sign in' : 'Sign in'}
          loading={busy}
          disabled={busy || !email.trim() || !password || (mfaRequired && totpCode.length !== 6)}
          onPress={() => void submit()}
        />
        {!mfaRequired ? <ActionButton label="Use authenticator code" quiet disabled={busy || !email.trim() || !password}
          onPress={() => { setMfaRequired(true); setPasswordVisible(false); setError(''); toast.dismiss(); }} /> : null}
        {mfaRequired ? <>
          <ActionButton label="Edit sign-in details" quiet disabled={busy} onPress={() => {
            setMfaRequired(false); setTotpCode(''); setError(''); toast.dismiss();
          }} />
          <ActionButton label="Cancel sign-in" secondary onPress={() => {
            ++submission.current;
            setBusy(false);
            toast.dismiss();
            signOut();
            setPassword(''); setTotpCode(''); setPasswordVisible(false); setMfaRequired(false); setError('');
          }} />
        </> : null}
      </View>
      {simulated && !mfaRequired ? <View style={{ gap: Spacing.two, borderTopWidth: 1, borderTopColor: theme.modalOutline, paddingTop: Spacing.four }}>
        <ThemedText>Use a demo account. No physical door will be operated.</ThemedText>
        <ThemedText selectable themeColor="textSecondary" style={{ fontSize: 14, lineHeight: 22 }}>
          Email: demo@latch.example{'\n'}Password: latch-demo-only{'\n'}
          MFA demo: mfa@latch.example · Code: 123456{'\n'}
          Organisation and door choices: multi@latch.example
        </ThemedText>
      </View> : !simulated && !mfaRequired ? <ThemedText themeColor="textSecondary" type="small">SSO-only accounts are not supported.</ThemedText> : null}
      {__DEV__ && simulated && process.env.EXPO_PUBLIC_SENTRY_VERIFY === '1' ? <>
        <ActionButton label="Send Sentry test error" secondary disabled={busy} loading={verifyingMonitoring} onPress={async () => {
          if (verifyingMonitoring) return;
          setVerifyingMonitoring(true);
          try { setVerification(`${await sendMonitoringVerification()} queued. Receipt still needs confirmation in Sentry.`); }
          catch { setVerification('The test error could not be queued.'); }
          finally { setVerifyingMonitoring(false); }
        }} />
        {verification ? <ThemedText selectable accessibilityLiveRegion="polite">{verification}</ThemedText> : null}
      </> : null}
    </AccessScreen>
  );
}
