import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Pressable, TextInput, View } from 'react-native';
import { toast } from 'sonner-native';

import { AccessScreen } from '@/components/access-screen';
import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLatch } from '@/services/latch-context';
import { AccessError, safeAccessError } from '@/lib/access-error';

export default function HomeScreen() {
  const theme = useTheme();
  const { signIn, signOut, authState, retrySession } = useLatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputStyle = {
    color: theme.text,
    backgroundColor: theme.backgroundElement,
    borderColor: theme.inputOutline,
    borderWidth: 1,
    borderRadius: Spacing.two,
    minHeight: 56,
    padding: Spacing.three,
    fontSize: 16,
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
      setError(failure.code === 'invalid-credentials' ? 'Sign-in failed. Use the demo account shown above.' : failure.message);
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
    <AccessScreen>
      <ThemedText>Use a demo account. No physical door will be operated.</ThemedText>
      <ThemedText selectable themeColor="textSecondary">
        Email: demo@latch.example{'\n'}Password: latch-demo-only{'\n'}
        MFA demo: mfa@latch.example · Code: 123456
      </ThemedText>
      <ThemedText>Email</ThemedText>
      <TextInput
        accessibilityLabel="Email"
        value={email}
        onChangeText={(value) => { setEmail(value); setMfaRequired(false); setTotpCode(''); setError(''); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        editable={!busy}
        style={inputStyle}
      />
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
      {mfaRequired ? (
        <>
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
        </>
      ) : null}
      {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
      {!error && authState.error ? <ThemedText accessibilityRole="alert">{new AccessError(authState.error).message}</ThemedText> : null}
      {['storage', 'unavailable'].includes(authState.error ?? '') ? <ActionButton label="Retry session check" secondary disabled={busy} onPress={retrySession} /> : null}
      <ActionButton
        label={busy ? 'Signing in…' : 'Sign in'}
        disabled={busy || !email.trim() || !password || (mfaRequired && totpCode.length !== 6)}
        onPress={() => void submit()}
      />
      {mfaRequired ? <ActionButton label="Cancel sign-in" secondary onPress={() => {
        toast.dismiss();
        signOut();
        setPassword(''); setTotpCode(''); setPasswordVisible(false); setMfaRequired(false); setError('');
      }} /> : null}
    </AccessScreen>
  );
}
