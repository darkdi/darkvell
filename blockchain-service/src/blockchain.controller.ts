import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { BlockchainService } from "./blockchain.service.js";

@Controller()
export class BlockchainController {
  constructor(@Inject(BlockchainService) private readonly blockchain: BlockchainService) {}

  @Get("/health")
  health() {
    return {
      ok: true,
      service: "blockchain-service",
      network: this.blockchain.network
    };
  }

  @Get("/wallet/ton/config")
  tonConfig() {
    return this.blockchain.tonConfig();
  }

  @Post("/claims/reward")
  rewardClaim(@Body() body: { playerId?: string; walletAddress?: string; amount?: number }) {
    return this.blockchain.queueTonReward(body.playerId, body.walletAddress, body.amount);
  }

  @Post("/lightning/invoice")
  lightningInvoice(@Body() body: { playerId?: string; sats?: number; memo?: string }) {
    return this.blockchain.createLightningInvoice(body.playerId, body.sats, body.memo);
  }
}
