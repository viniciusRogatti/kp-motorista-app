import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { appConfig } from '@/config';
import { apiRequest } from '@/services/http';

const DEVICE_ID_KEY = 'kp.motorista.installation-id.v1';
const ROUTE_END_NOTIFICATION_ID_KEY = 'kp.motorista.route-end-notification.v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

export async function getInstallationId() {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created);
  return created;
}

export async function registerPushToken(token: string) {
  if (!Device.isDevice) return { registered: false, reason: 'physical_device_required' };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('operacao', {
      name: 'Operacao da rota', importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return { registered: false, reason: 'permission_denied' };
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) throw new Error('EAS projectId nao configurado para notificacoes.');
  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await apiRequest('/driver-app/push-token', {
    method: 'POST', token,
    body: JSON.stringify({
      expoPushToken,
      deviceId: await getInstallationId(),
      platform: Platform.OS,
      appEnvironment: appConfig.appEnv,
    }),
  });
  return { registered: true };
}

export async function notifyTrackingLogout(token: string) {
  await apiRequest('/driver-app/tracking/logout', {
    method: 'POST', token,
    body: JSON.stringify({ deviceId: await getInstallationId() }),
  });
}

export async function scheduleRouteEndReminder(stopAt: string | null | undefined) {
  const previousId = await SecureStore.getItemAsync(ROUTE_END_NOTIFICATION_ID_KEY);
  if (previousId) await Notifications.cancelScheduledNotificationAsync(previousId).catch(() => undefined);
  if (!stopAt) {
    await SecureStore.deleteItemAsync(ROUTE_END_NOTIFICATION_ID_KEY);
    return;
  }
  const date = new Date(stopAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rota encerrada',
      body: 'Faca logout e devolva o aparelho.',
      data: { screen: 'home', type: 'route_logout_reminder' },
      sound: 'default',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
  await SecureStore.setItemAsync(ROUTE_END_NOTIFICATION_ID_KEY, id);
}
