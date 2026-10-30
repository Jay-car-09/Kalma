import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { problemText, resendSecondsLeft, sendCode, verifyCode } from '@/cloud/signIn';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { spacing } from '@/theme/tokens';

// Step 2 of 2: the 6-digit code from the email.
export default function VerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(sentAt);
  const secondsLeft = resendSecondsLeft(sentAt, now);
  const counting = secondsLeft > 0;

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  async function onVerify(token: string) {
    if (busy || token.length !== 6) return;
    setProblem(null);
    setBusy(true);
    try {
      await verifyCode(email, token);
      router.dismissTo('/account'); // the Account tab now shows the signed-in state
    } catch (error) {
      setCode('');
      setProblem(problemText(t, error, Date.now() - sentAt));
    } finally {
      setBusy(false);
    }
  }

  function onChangeCode(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) onVerify(digits); // autofill fills all 6 at once
  }

  async function onResend() {
    setProblem(null);
    setBusy(true);
    try {
      await sendCode(email);
      const sent = Date.now();
      setSentAt(sent);
      setNow(sent);
      setCode('');
    } catch (error) {
      setProblem(problemText(t, error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('signIn.codeTitle')} onBack={router.back}>
      <AppText tone="secondary">{t('signIn.codeIntro', { email })}</AppText>
      <View style={styles.form}>
        <TextField
          label={t('signIn.code')}
          value={code}
          onChangeText={onChangeCode}
          error={problem}
          autoFocus
          maxLength={6}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          style={styles.code}
        />
        <Button label={t('signIn.verify')} onPress={() => onVerify(code)} disabled={busy || code.length !== 6} />
        <View>
          <Button
            variant="plain"
            label={counting ? t('signIn.resendIn', { seconds: secondsLeft }) : t('signIn.resend')}
            onPress={onResend}
            disabled={busy || counting}
          />
          <Button variant="plain" label={t('signIn.differentEmail')} onPress={router.back} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  code: { fontVariant: ['tabular-nums'], letterSpacing: spacing.sm },
});
