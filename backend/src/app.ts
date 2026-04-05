import express, { Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { globalRateLimit } from './middleware/rate-limit';
import { errorHandler } from './middleware/error';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import businessesRouter from './routes/businesses';
import reviewsRouter from './routes/reviews';

const app: Application = express();

// CORS
app.use(
  cors({
    origin: [...config.cors.origins, 'https://mettig.ru'],
    credentials: true,
  }),
);

// Logger
if (config.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limit
app.use(globalRateLimit);

// Routes
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/user', userRouter);
app.use('/businesses', businessesRouter);
app.use('/reviews', reviewsRouter);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
