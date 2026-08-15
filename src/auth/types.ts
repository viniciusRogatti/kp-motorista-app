export type DriverIdentity = {
  permission: string;
  driverId: number;
  companyId: number;
  companyCode: string | null;
  companyName: string | null;
  name: string | null;
  username: string;
};

export type DriverSession = {
  token: string;
  user: DriverIdentity;
};

export type SessionValidation = 'valid' | 'invalid' | 'unavailable';
