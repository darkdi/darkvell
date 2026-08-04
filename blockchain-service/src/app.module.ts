import { Module } from "@nestjs/common";
import { BlockchainController } from "./blockchain.controller.js";
import { BlockchainService } from "./blockchain.service.js";

@Module({
  controllers: [BlockchainController],
  providers: [BlockchainService]
})
export class AppModule {}
