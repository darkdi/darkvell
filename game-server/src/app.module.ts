import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { GameRealtimeService } from "./realtime.service.js";
import { WorldService } from "./world.service.js";

@Module({
  controllers: [HealthController],
  providers: [WorldService, GameRealtimeService]
})
export class AppModule {}
