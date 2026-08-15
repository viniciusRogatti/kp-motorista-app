import { StyleSheet, Text, View } from 'react-native';

import { appConfig } from '@/config';

const COLORS = {
  development: '#19C37D',
  preview: '#F5A524',
  production: '#0B1830',
} as const;

export function EnvironmentBanner() {
  if (appConfig.appEnv === 'production') return null;
  const label = appConfig.appEnv === 'development' ? 'DESENVOLVIMENTO' : 'HOMOLOGAÇÃO';
  const mode = appConfig.operationsMode === 'live'
    ? 'OPERAÇÃO ATIVA'
    : appConfig.operationsMode === 'simulation'
      ? 'SIMULAÇÃO LOCAL'
      : 'SOMENTE LEITURA';
  return (
    <View style={[styles.container, { backgroundColor: COLORS[appConfig.appEnv] }]}>
      <Text style={styles.text}>{label} • {mode}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 7, alignItems: 'center' },
  text: { color: '#081426', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textAlign: 'center' },
});
