import { Redirect, Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { EnvironmentBanner } from '@/components/EnvironmentBanner';
import { isNonProduction } from '@/config';

export default function LoginScreen() {
  const { session, isLoading: isRestoring, signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (isRestoring) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#FFFFFF" size="large" />
        <Text style={styles.loadingText}>Validando sessão segura…</Text>
      </View>
    );
  }

  if (session) return <Redirect href="/home" />;

  async function submit() {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password.trim()) {
      setErrorMessage('Informe seu usuário e sua senha.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await signIn(normalizedUsername, password);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível entrar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <EnvironmentBanner />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardArea}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.brand}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>KP</Text></View>
              <Text style={styles.eyebrow}>KP TRANSPORTES</Text>
              <Text style={styles.title}>Área do motorista</Text>
              <Text style={styles.subtitle}>Entre com o mesmo usuário utilizado no sistema da transportadora.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Acessar operação</Text>
              <Text style={styles.label}>Usuário</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="username"
                editable={!isSubmitting}
                onChangeText={(value) => { setUsername(value); setErrorMessage(''); }}
                placeholder="Digite seu usuário"
                placeholderTextColor="#8A95A6"
                returnKeyType="next"
                style={styles.input}
                value={username}
              />

              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordField}>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="current-password"
                  editable={!isSubmitting}
                  onChangeText={(value) => { setPassword(value); setErrorMessage(''); }}
                  onSubmitEditing={() => void submit()}
                  placeholder="Digite sua senha"
                  placeholderTextColor="#8A95A6"
                  returnKeyType="done"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  hitSlop={8}
                  onPress={() => setShowPassword((value) => !value)}
                >
                  <Text style={styles.showPassword}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
                </Pressable>
              </View>

              {errorMessage ? (
                <View accessibilityRole="alert" style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => void submit()}
                style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, isSubmitting && styles.submitDisabled]}
              >
                {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Entrar</Text>}
              </Pressable>
              <Text style={styles.securityNote}>Sua senha não é armazenada neste aparelho.</Text>
            </View>

            {isNonProduction ? (
              <Link href="/diagnostics" asChild>
                <Pressable accessibilityRole="button" style={styles.diagnosticLink}>
                  <Text style={styles.diagnosticText}>Abrir diagnóstico técnico</Text>
                </Pressable>
              </Link>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1830' },
  safeArea: { flex: 1 },
  keyboardArea: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingBottom: 36, gap: 22 },
  loadingScreen: { flex: 1, backgroundColor: '#0B1830', alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: '#B8C6DA', fontSize: 14 },
  brand: { paddingTop: 18 },
  brandMark: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#2E80FF', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  brandMarkText: { color: '#FFFFFF', fontWeight: '900', fontSize: 20, letterSpacing: -1 },
  eyebrow: { color: '#6E9DE5', fontWeight: '800', fontSize: 11, letterSpacing: 2.1 },
  title: { color: '#FFFFFF', fontWeight: '900', fontSize: 36, letterSpacing: -1.4, marginTop: 5 },
  subtitle: { color: '#B8C6DA', fontSize: 15, lineHeight: 22, marginTop: 9, maxWidth: 340 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 },
  cardTitle: { color: '#152033', fontWeight: '900', fontSize: 22, marginBottom: 20 },
  label: { color: '#344156', fontSize: 13, fontWeight: '800', marginBottom: 7 },
  input: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: '#DCE2EA', backgroundColor: '#F8FAFC', color: '#17243A', paddingHorizontal: 15, fontSize: 16, marginBottom: 16 },
  passwordField: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: '#DCE2EA', backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  passwordInput: { flex: 1, color: '#17243A', paddingHorizontal: 15, fontSize: 16 },
  showPassword: { color: '#0B5CD6', fontWeight: '800', fontSize: 12, paddingRight: 14 },
  errorBox: { backgroundColor: '#FFF0F0', borderRadius: 12, padding: 12, marginTop: 12 },
  errorText: { color: '#A42323', fontSize: 13, lineHeight: 19 },
  submit: { height: 54, borderRadius: 15, backgroundColor: '#1268E8', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  submitPressed: { opacity: 0.88 },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  securityNote: { color: '#778397', textAlign: 'center', fontSize: 11, marginTop: 12 },
  diagnosticLink: { alignItems: 'center', paddingVertical: 12 },
  diagnosticText: { color: '#9BBCEB', fontSize: 13, fontWeight: '700' },
});
