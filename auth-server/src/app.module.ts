import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { PremiumService } from "./premium.service.js";
import { CoinPaymentService } from "./coin-payment.service.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, PremiumService, CoinPaymentService]
})
export class AppModule {}
