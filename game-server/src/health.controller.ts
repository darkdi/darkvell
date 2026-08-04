import { Controller, Get, Inject } from "@nestjs/common";
import { WorldService } from "./world.service.js";

@Controller()
export class HealthController {
  constructor(@Inject(WorldService) private readonly world: WorldService) {}

  @Get("/health")
  health() {
    return {
      ok: true,
      service: "game-server",
      players: this.world.playerCount,
      tick: this.world.currentTick
    };
  }
}
