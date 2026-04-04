import app from './app';
import { config } from './config';

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server shut down gracefully');
    process.exit(0);
  });
});

export default app;
