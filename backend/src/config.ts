import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  db: {
    url: process.env['DATABASE_URL'] ?? '',
    poolMin: parseInt(process.env['DB_POOL_MIN'] ?? '2', 10),
    poolMax: parseInt(process.env['DB_POOL_MAX'] ?? '10', 10),
  },
  jwt: {
    accessSecret: process.env['JWT_ACCESS_SECRET'] ?? 'dev-access-secret',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] ?? 'dev-refresh-secret',
    accessExpiresIn: process.env['JWT_ACCESS_EXPIRES_IN'] ?? '1h',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '30d',
  },
  smsru: {
    apiId: process.env['SMSRU_API_ID'] ?? '',
  },
  cors: {
    origins: (process.env['CORS_ORIGINS'] ?? 'http://localhost:5173').split(','),
  },
  whatsapp: {
    apiToken: process.env['WHATSAPP_API_TOKEN'] ?? '',
    phoneNumberId: process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '',
  },
  analyticsSalt: process.env['ANALYTICS_SALT'] ?? 'dev-analytics-salt',
  s3: {
    endpoint: process.env['S3_ENDPOINT'] ?? 'https://storage.yandexcloud.net',
    region: process.env['S3_REGION'] ?? 'ru-central1',
    bucket: process.env['S3_BUCKET'] ?? 'mettig',
    accessKeyId: process.env['S3_ACCESS_KEY'] ?? '',
    secretAccessKey: process.env['S3_SECRET_KEY'] ?? '',
    urlExpiration: parseInt(process.env['S3_URL_EXPIRATION'] ?? '3600', 10), // 1 hour
  },
} as const;
