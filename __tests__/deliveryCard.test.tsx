import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { DeliveryCard } from '@/components/trips/DeliveryCard';
import type { AssignedTrip } from '@/types/trip';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: unknown) => ({ value }),
    withSpring: (value: unknown) => value,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const gesture = {
    activeOffsetX: () => gesture,
    failOffsetY: () => gesture,
    onUpdate: () => gesture,
    onEnd: () => gesture,
    onFinalize: () => gesture,
  };
  return {
    Gesture: { Pan: () => gesture },
    GestureDetector: ({ children }: { children: ReactNode }) => children,
  };
});

type Stop = AssignedTrip['stops'][number];

const stop: Stop = {
  id: 42,
  companyId: 1,
  companyCode: 'KP',
  sequence: 2,
  invoiceNumber: '1853712',
  customerName: 'Mercado Central',
  city: 'São Paulo',
  status: 'arrived',
  grossWeight: 18.5,
  boxQuantity: 3,
  customerId: '900',
  phone: null,
  address: 'Rua Central',
  addressNumber: '100',
  neighborhood: 'Centro',
  state: 'SP',
  zipCode: '01000-000',
  representativeName: null,
  receiptGroupName: null,
  products: [],
  updatedAt: null,
};

describe('DeliveryCard', () => {
  it('mostra somente NF e cliente no card compacto', () => {
    const screen = render(<DeliveryCard compact onDetails={jest.fn()} stop={stop} />);

    expect(screen.getByText('NF 1853712')).toBeTruthy();
    expect(screen.getByText('Mercado Central')).toBeTruthy();
    expect(screen.queryByText('São Paulo • NF 1853712')).toBeNull();
    expect(screen.queryByText('No local')).toBeNull();
  });

  it('mantém os detalhes no primeiro card do grupo', () => {
    const screen = render(<DeliveryCard onDetails={jest.fn()} stop={stop} />);

    expect(screen.getByText('São Paulo • NF 1853712')).toBeTruthy();
    expect(screen.getByText('No local')).toBeTruthy();
  });
});
