import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable CORS - dev-friendly for local + network testing (Mac + iPhone etc.)
  // Usage:
  //   - Default: allows localhost, 127.0.0.1 and common private network ranges (192.168.*, 10.*, 172.*)
  //   - To explicitly add more (or restrict): CORS_ORIGIN="http://192.168.1.42:3000,http://my-other-device:3000"
  const corsOriginEnv = process.env.CORS_ORIGIN;
  const explicitOrigins = corsOriginEnv ? corsOriginEnv.split(',').map(o => o.trim()) : [];
  const defaultLocalOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, server-to-server)
      if (!origin) return callback(null, true);

      const allowed = [...defaultLocalOrigins, ...explicitOrigins];

      // Always allow common local dev origins
      const isLocalhost = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
      const isPrivateNetwork = 
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://10.') ||
        origin.startsWith('http://172.16.') || origin.startsWith('http://172.17.') ||
        origin.startsWith('http://172.18.') || origin.startsWith('http://172.19.') ||
        origin.startsWith('http://172.20.') || origin.startsWith('http://172.21.') ||
        origin.startsWith('http://172.22.') || origin.startsWith('http://172.23.') ||
        origin.startsWith('http://172.24.') || origin.startsWith('http://172.25.') ||
        origin.startsWith('http://172.26.') || origin.startsWith('http://172.27.') ||
        origin.startsWith('http://172.28.') || origin.startsWith('http://172.29.') ||
        origin.startsWith('http://172.30.') || origin.startsWith('http://172.31.');

      if (allowed.includes(origin) || isLocalhost || isPrivateNetwork) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 3600,
  });

  // Enable validation pipes globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  // Bind to 0.0.0.0 so it's reachable from other devices on the local network (iPhone etc.)
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend is running on:`);
  console.log(`   - Local:   http://localhost:${port}/api`);
  console.log(`   - Network: http://<deine-ip>:${port}/api   <--- deine IP (192.168.178.24 für dich)`);
  console.log(`   (Für iPhone: im Frontend-Ordner "npm run dev:mobile" ausführen - das verwendet deine IP automatisch)`);
}

bootstrap();
