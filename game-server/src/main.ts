import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.enableShutdownHooks();

  const port = Number(process.env.GAME_HTTP_PORT ?? 3100);
  await app.listen(port);
  console.log(`game-server http listening on :${port}`);
}

bootstrap().catch((error) => {
  console.error("game-server failed to start", error);
  process.exit(1);
});
