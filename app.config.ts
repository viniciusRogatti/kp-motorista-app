import type { ConfigContext, ExpoConfig } from 'expo/config';

type AppEnvironment = 'development' | 'preview' | 'production';

const ENVIRONMENTS: Record<AppEnvironment, { name: string; suffix: string }> = {
  development: { name: 'KP Motorista Dev', suffix: '.dev' },
  preview: { name: 'KP Motorista Teste', suffix: '.preview' },
  production: { name: 'KP Motorista', suffix: '' },
};

function resolveEnvironment(value?: string): AppEnvironment {
  if (!value) return 'development';
  if (value === 'development' || value === 'preview' || value === 'production') return value;
  throw new Error(`APP_ENV invalido: "${value}". Use development, preview ou production.`);
}

function requireHttpUrl(name: string, value: string, environment: AppEnvironment) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} precisa ser uma URL http(s) valida.`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} precisa usar http ou https.`);
  }

  if (environment === 'production' && ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname)) {
    throw new Error(`${name} nao pode apontar para um host local em production.`);
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const environment = resolveEnvironment(process.env.APP_ENV);
  const variant = ENVIRONMENTS[environment];
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3001';
  const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL || apiUrl;
  const packageBase = process.env.ANDROID_PACKAGE_NAME || 'com.kptransportes.motorista';

  requireHttpUrl('EXPO_PUBLIC_API_URL', apiUrl, environment);
  requireHttpUrl('EXPO_PUBLIC_SOCKET_URL', socketUrl, environment);

  if (environment !== 'development' && !process.env.EXPO_PUBLIC_API_URL) {
    throw new Error(`EXPO_PUBLIC_API_URL e obrigatoria no ambiente ${environment}.`);
  }

  if (environment === 'production' && !process.env.ANDROID_PACKAGE_NAME) {
    throw new Error('ANDROID_PACKAGE_NAME precisa ser aprovado e informado para o build de production.');
  }

  return {
    ...config,
    name: variant.name,
    slug: 'kp-motorista-app',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: environment === 'production' ? 'kpmotorista' : `kpmotorista-${environment}`,
    userInterfaceStyle: 'light',
    runtimeVersion: { policy: 'appVersion' },
    android: {
      package: `${packageBase}${variant.suffix}`,
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: '#0B1830',
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'POST_NOTIFICATIONS',
        'CAMERA',
      ],
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.RECORD_AUDIO',
      ],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: false,
          data: [{ scheme: environment === 'production' ? 'kpmotorista' : `kpmotorista-${environment}` }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      ['expo-secure-store', { configureAndroidBackup: true }],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'A KP Transportes usa sua localizacao somente durante uma viagem ativa.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Permita a camera para fotografar canhotos e comprovantes da entrega.',
          recordAudioAndroid: false,
        },
      ],
      [
        'expo-notifications',
        { defaultChannel: 'operacao' },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#0B1830',
          image: './assets/images/splash-icon.png',
          imageWidth: 96,
        },
      ],
      ['expo-dev-client', { launchMode: 'most-recent' }],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    extra: {
      appEnv: environment,
      apiUrl,
      socketUrl,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
      mapProvider: process.env.EXPO_PUBLIC_MAP_PROVIDER || 'external',
      buildChannel: process.env.EXPO_PUBLIC_BUILD_CHANNEL || environment,
      buildDate: process.env.BUILD_DATE || new Date().toISOString(),
      commitSha: process.env.GIT_COMMIT_SHA || '',
      operationsMode: process.env.EXPO_PUBLIC_OPERATIONS_MODE || 'observation',
      eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined },
    },
  };
};
