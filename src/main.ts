import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors();

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('OpenAI API Testing Project')
    .setDescription(
      'Comprehensive testing project for OpenAI APIs including Responses API (chat + gpt-image-1), Images API (DALL-E 3), and Videos API (Sora-2)',
    )
    .setVersion('1.0')
    .addTag('Responses API', 'Text and image generation via Responses API')
    .addTag('Images API', 'DALL-E 3 image generation')
    .addTag('Videos API', 'Sora-2 video generation')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  OpenAI API Testing Project                                    ║
╠════════════════════════════════════════════════════════════════╣
║  Application is running on: http://localhost:${port}           ║
║  Swagger Documentation:     http://localhost:${port}/api-docs  ║
╚════════════════════════════════════════════════════════════════╝
  `);
}
void bootstrap();
