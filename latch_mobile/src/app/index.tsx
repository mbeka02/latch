import { useState } from 'react';
import { TextInput } from 'react-native';

import { AccessScreen } from '@/components/access-screen';
import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLatch } from '@/services/latch-context';

export default function HomeScreen() {
  const theme = useTheme();
  const { signIn } = useLatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    const input = { email, password };
    setPassword('');
    try {
      await signIn(input);
    } catch {
      setError('Sign-in failed. Use the demo account shown above.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessScreen>
      <ThemedText>Use a demo account. No physical door will be operated.</ThemedText>
      <ThemedText selectable themeColor="textSecondary">
        Email: demo@latch.example{'\n'}Password: latch-demo-only
      </ThemedText>
      <ThemedText>Email</ThemedText>
      <TextInput
        accessibilityLabel="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        editable={!busy}
        style={inputStyle}
      />
      <ThemedText>Password</ThemedText>
      <TextInput
        accessibilityLabel="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        editable={!busy}
        style={inputStyle}
      />
      {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
      <ActionButton
        label={busy ? 'Signing in…' : 'Sign in'}
        disabled={busy || !email.trim() || !password}
        onPress={() => void submit()}
      />
    </AccessScreen>
  );
}
