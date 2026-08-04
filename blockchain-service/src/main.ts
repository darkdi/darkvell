import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = Number(process.env.BLOCKCHAIN_HTTP_PORT ?? 3300);
  await app.listen(port);
  console.log(`blockchain-service listening on :${port}`);
}

bootstrap().catch((error) => {
  console.error("blockchain-service failed to start", error);
  process.exit(1);
});
