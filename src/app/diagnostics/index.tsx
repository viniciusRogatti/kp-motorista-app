import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { io, type Socket } from 'socket.io-client';

import { ActionButton } from '@/components/ActionButton';
import { EnvironmentBanner } from '@/components/EnvironmentBanner';
import { InfoRow } from '@/components/InfoRow';
import { appConfig } from '@/config';
import { getQueueSummary, retryEligibleActions } from '@/database/offlineQueue';
import { saveLocation } from '@/database/locationRepository';
import { checkApiHealth } from '@/services/api';
import {
  isBackgroundTrackingActive,
  startDiagnosticTracking,
  stopDiagnosticTracking,
} from '@/tasks/backgroundLocation';
import type { DiagnosticSnapshot } from '@/types/diagnostics';

const initialSnapshot: DiagnosticSnapshot = {
  environment: appConfig.appEnv,
  api: appConfig.apiUrl,
  socket: appConfig.socketUrl,
  foregroundPermission: 'unknown',
  backgroundPermission: 'unknown',
  locationServices: false,
  trackingActive: false,
  networkConnected: null,
  apiStatus: 'não testada',
  socketStatus: 'conectando',
  lastLocation: null,
  pendingPositions: 0,
  pendingActions: 0,
  pendingMedia: 0,
  lastSync: null,
};

function DiagnosticSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function DiagnosticsScreen() {
  const db = useSQLiteContext();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState<string | null>(null);
  const [simulateOffline, setSimulateOffline] = useState(false);

  const refresh = useCallback(async () => {
    const [foreground, background, services, tracking, network, queue] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Location.hasServicesEnabledAsync(),
      isBackgroundTrackingActive(),
      Network.getNetworkStateAsync(),
      getQueueSummary(db),
    ]);

    let apiStatus = simulateOffline ? 'bloqueada por simulação' : 'indisponível';
    if (!simulateOffline) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      try {
        const health = await checkApiHealth(controller.signal);
        apiStatus = `HTTP ${health.status} • ${health.latencyMs} ms`;
      } catch {
        apiStatus = 'sem resposta';
      } finally {
        clearTimeout(timeout);
      }
    }

    setSnapshot((current) => ({
      ...current,
      foregroundPermission: foreground.status,
      backgroundPermission: background.status,
      locationServices: services,
      trackingActive: tracking,
      networkConnected: simulateOffline ? false : (network.isConnected ?? null),
      apiStatus,
      pendingPositions: queue.pendingPositions,
      pendingActions: Object.entries(queue.actions)
        .filter(([status]) => status !== 'confirmed')
        .reduce((total, [, count]) => total + (count ?? 0), 0),
      pendingMedia: queue.pendingMedia,
      lastSync: new Date().toISOString(),
    }));
  }, [db, simulateOffline]);

  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timeout);
  }, [refresh]);

  useEffect(() => {
    if (simulateOffline) return;

    const socket: Socket = io(appConfig.socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 2,
      timeout: 5_000,
    });
    socket.on('connect', () => setSnapshot((current) => ({ ...current, socketStatus: 'conectado' })));
    socket.on('disconnect', () => setSnapshot((current) => ({ ...current, socketStatus: 'desconectado' })));
    socket.on('connect_error', () => setSnapshot((current) => ({ ...current, socketStatus: 'sem conexão' })));
    return () => {
      socket.disconnect();
    };
  }, [simulateOffline]);

  async function run(label: string, action: () => Promise<void>) {
    setLoading(label);
    try {
      await action();
    } catch (error) {
      Alert.alert('Diagnóstico não concluído', error instanceof Error ? error.message : 'Erro desconhecido.');
    } finally {
      setLoading(null);
      await refresh();
    }
  }

  async function captureLocation() {
    await run('capture', async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Permita a localização durante o uso para capturar uma posição.');
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await saveLocation(db, location);
      setSnapshot((current) => ({
        ...current,
        lastLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          heading: location.coords.heading,
          timestamp: new Date(location.timestamp).toISOString(),
        },
      }));
    });
  }

  async function startTracking() {
    await run('start', async () => {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (!foreground.granted) throw new Error('A localização durante o uso precisa ser permitida primeiro.');
      const background = await Location.requestBackgroundPermissionsAsync();
      if (!background.granted) {
        throw new Error('No Android, escolha “Permitir o tempo todo” para testar com a tela bloqueada.');
      }
      await startDiagnosticTracking();
    });
  }

  async function copyDiagnostics() {
    const safeCopy = {
      ...snapshot,
      api: new URL(snapshot.api).origin,
      socket: new URL(snapshot.socket).origin,
      device: `${Platform.OS} ${Platform.Version}`,
      appVersion: Application.nativeApplicationVersion,
      buildVersion: Application.nativeBuildVersion,
    };
    await Clipboard.setStringAsync(JSON.stringify(safeCopy, null, 2));
    Alert.alert('Diagnóstico copiado', 'O texto não contém token, senha ou coordenada histórica além da última captura exibida.');
  }

  const locationLabel = snapshot.lastLocation
    ? `${snapshot.lastLocation.latitude.toFixed(6)}, ${snapshot.lastLocation.longitude.toFixed(6)}`
    : 'ainda não capturada';
  const socketStatus = simulateOffline ? 'bloqueado por simulação' : snapshot.socketStatus;

  return (
    <View style={styles.screen}>
      <EnvironmentBanner />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>INTERNO • DEV/PREVIEW</Text>
          <Text style={styles.title}>Saúde do aplicativo</Text>
          <Text style={styles.description}>Valide um item de cada vez no aparelho físico. O rastreamento iniciado aqui é apenas um teste controlado.</Text>
        </View>

        <DiagnosticSection title="Ambiente e conectividade">
          <InfoRow label="Ambiente" value={snapshot.environment} tone={snapshot.environment === 'production' ? 'warn' : 'good'} />
          <InfoRow label="API" value={snapshot.api} />
          <InfoRow label="Status API" value={snapshot.apiStatus} tone={snapshot.apiStatus.includes('HTTP') ? 'good' : 'warn'} />
          <InfoRow label="Socket.IO" value={socketStatus} tone={socketStatus === 'conectado' ? 'good' : 'warn'} />
          <InfoRow label="Internet" value={snapshot.networkConnected ? 'conectada' : 'sem conexão'} tone={snapshot.networkConnected ? 'good' : 'warn'} />
        </DiagnosticSection>

        <DiagnosticSection title="Localização">
          <InfoRow label="Durante o uso" value={snapshot.foregroundPermission} />
          <InfoRow label="Em segundo plano" value={snapshot.backgroundPermission} />
          <InfoRow label="Serviço de localização" value={snapshot.locationServices ? 'ligado' : 'desligado'} tone={snapshot.locationServices ? 'good' : 'warn'} />
          <InfoRow label="Foreground service" value={snapshot.trackingActive ? 'ativo' : 'parado'} tone={snapshot.trackingActive ? 'good' : 'default'} />
          <InfoRow label="Última posição" value={locationLabel} />
          <InfoRow label="Precisão" value={snapshot.lastLocation?.accuracy ? `${Math.round(snapshot.lastLocation.accuracy)} m` : '—'} />
          <InfoRow label="Velocidade / direção" value={snapshot.lastLocation ? `${snapshot.lastLocation.speed ?? 0} m/s • ${snapshot.lastLocation.heading ?? 0}°` : '—'} />
        </DiagnosticSection>

        <DiagnosticSection title="SQLite e fila offline">
          <InfoRow label="Ações pendentes" value={String(snapshot.pendingActions)} />
          <InfoRow label="Posições pendentes" value={String(snapshot.pendingPositions)} />
          <InfoRow label="Fotos pendentes" value={String(snapshot.pendingMedia)} />
          <InfoRow label="Última leitura" value={snapshot.lastSync ?? '—'} />
        </DiagnosticSection>

        <View style={styles.actions}>
          <ActionButton loading={loading === 'capture'} onPress={captureLocation}>Capturar localização agora</ActionButton>
          {snapshot.trackingActive ? (
            <ActionButton variant="danger" loading={loading === 'stop'} onPress={() => run('stop', stopDiagnosticTracking)}>Parar rastreamento de teste</ActionButton>
          ) : (
            <ActionButton variant="secondary" loading={loading === 'start'} onPress={startTracking}>Iniciar rastreamento de teste</ActionButton>
          )}
          <ActionButton variant="secondary" onPress={() => setSimulateOffline((value) => !value)}>
            {simulateOffline ? 'Encerrar simulação offline' : 'Simular perda de internet'}
          </ActionButton>
          <ActionButton variant="secondary" onPress={() => run('retry', async () => { await retryEligibleActions(db); })}>Reenviar fila elegível</ActionButton>
          <ActionButton variant="secondary" onPress={copyDiagnostics}>Copiar diagnóstico seguro</ActionButton>
        </View>

        <Text style={styles.footer}>v{Application.nativeApplicationVersion ?? '0.1.0'} ({Application.nativeBuildVersion ?? '1'}) • {appConfig.buildChannel}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6FA' },
  content: { padding: 18, paddingBottom: 40, gap: 16 },
  intro: { paddingVertical: 6 },
  eyebrow: { color: '#0B5CD6', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#132036', fontSize: 30, fontWeight: '900', letterSpacing: -1, marginTop: 5 },
  description: { color: '#657084', fontSize: 14, lineHeight: 21, marginTop: 8 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 17, paddingTop: 17, paddingBottom: 6, borderWidth: 1, borderColor: '#E6EAF0' },
  sectionTitle: { color: '#17243A', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  actions: { gap: 10, marginTop: 2 },
  footer: { textAlign: 'center', color: '#7A8494', fontSize: 11, marginTop: 4 },
});
