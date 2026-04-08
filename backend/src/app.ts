import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { globalRateLimit, authRateLimit, bookingsRateLimit } from './middleware/rate-limit';
import { errorHandler } from './middleware/error';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import businessesRouter from './routes/businesses';
import reviewsRouter from './routes/reviews';
import bookingsRouter from './routes/bookings';
import eventsRouter from './routes/events';
import categoriesRouter from './routes/categories';
import favoritesRouter from './routes/favorites';
import businessRouter from './routes/business';
import uploadRouter from './routes/upload';

const app: Application = express();

// Security headers (helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://mettig.ru', 'https://*.mettig.ru'],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow images from S3
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// CORS — restricted to localhost (dev) and mettig.ru (prod)
const allowedOrigins = [
  ...config.cors.origins,
  'https://mettig.ru',
  'https://www.mettig.ru',
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === 'string') return allowed === origin;
        return allowed.test(origin);
      });
      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);

// Logger
if (config.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global rate limit
app.use(globalRateLimit);

// Routes (with specific rate limits)
app.use('/health', healthRouter);
app.use('/auth', authRateLimit, authRouter);
app.use('/user', userRouter);
app.use('/businesses', businessesRouter);
app.use('/reviews', reviewsRouter);
app.use('/bookings', bookingsRateLimit, bookingsRouter);
app.use('/events', eventsRouter);
app.use('/categories', categoriesRouter);
app.use('/favorites', favoritesRouter);
app.use('/business', businessRouter);
app.use('/', uploadRouter);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
