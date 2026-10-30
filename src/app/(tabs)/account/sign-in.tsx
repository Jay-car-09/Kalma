import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { describeAuthError, isEmail, normalizeEmail, sendCode } from '@/cloud/signIn';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { spacing } from '@/theme/tokens';

// Step 1 of 2: the email address. The same screen creates an account or signs in.
export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSend() {
    const clean = normalizeEmail(email);
    if (!isEmail(clean)) {
      setProblem(t('signIn.badEmail'));
      return;
    }
    setProblem(null);
    setSending(true);
    try {
      await sendCode(clean);
      router.push({ pathname: '/account/verify', params: { email: clean } });
    } catch (error) {
      setProblem(t(`signIn.problem.${describeAuthError(error)}`));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen title={t('signIn.title')} onBack={router.back}>
      <AppText tone="secondary">{t('signIn.intro')}</AppText>
      <View style={styles.form}>
        <TextField
          label={t('signIn.email')}
          value={email}
          onChangeText={setEmail}
          error={problem}
          autoFocus
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
        <Button label={t('signIn.send')} onPress={onSend} disabled={sending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
});
