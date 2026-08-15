export type DiagnosticSnapshot = {
  environment: string;
  api: string;
  socket: string;
  foregroundPermission: string;
  backgroundPermission: string;
  locationServices: boolean;
  trackingActive: boolean;
  networkConnected: boolean | null;
  apiStatus: string;
  socketStatus: string;
  lastLocation: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
    timestamp: string;
  } | null;
  pendingPositions: number;
  pendingActions: number;
  pendingMedia: number;
  lastSync: string | null;
};
