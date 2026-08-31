import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';

export function UpdateCoordinator() {
  const { isUpdatePending } = Updates.useUpdates();
  const reloadRequested = useRef(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled || !isUpdatePending || reloadRequested.current) return;
    reloadRequested.current = true;
    void Updates.reloadAsync().catch(() => {
      reloadRequested.current = false;
    });
  }, [isUpdatePending]);

  return null;
}
