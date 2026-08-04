import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = Number(process.env.AUTH_HTTP_PORT ?? 3200);
  await app.listen(port);
  console.log(`auth-server listening on :${port}`);
}

bootstrap().catch((error) => {
  console.error("auth-server failed to start", error);
  process.exit(1);
});
