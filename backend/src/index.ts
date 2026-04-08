import app from './app';
import { config } from './config';
import { startReminderScheduler } from './utils/reminder-scheduler';

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
  if (config.nodeEnv !== 'test') {
    startReminderScheduler();
  }
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server shut down gracefully');
    process.exit(0);
  });
});

export default app;
