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

export default function HomeScreen() {
  const theme = useTheme();
  const { signIn } = useLatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
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
    setPasswordVisible(false);
    try {
      await signIn(input);
    } catch {
      setError('Sign-in failed. Use the demo account shown above.');
      toast.error('Unable to sign in', { description: 'Check the demo credentials and try again.' });
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
      {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
      <ActionButton
        label={busy ? 'Signing in…' : 'Sign in'}
        disabled={busy || !email.trim() || !password}
        onPress={() => void submit()}
      />
    </AccessScreen>
  );
}
