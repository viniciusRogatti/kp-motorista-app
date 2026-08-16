import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/auth/AuthContext';
import { registerPushToken } from '@/services/mobileNotifications';

export function NotificationCoordinator() {
  const router = useRouter();
  const { session } = useAuth();

  useEffect(() => {
    if (!session?.token) return;
    void registerPushToken(session.token).catch((error) => console.warn('[push] registration failed', error));
  }, [session?.token]);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (data?.screen === 'pending-receipts') {
        const tripId = Number(data.tripId || 0);
        router.push({ pathname: '/pending-receipts', params: tripId > 0 ? { tripId: String(tripId) } : {} } as never);
      } else {
        router.replace('/home');
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) open(response); });
    return () => subscription.remove();
  }, [router]);

  return null;
}
