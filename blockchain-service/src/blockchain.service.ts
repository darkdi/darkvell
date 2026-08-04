import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

export interface ClaimRecord {
  claimId: string;
  playerId: string;
  walletAddress: string;
  amount: number;
  currency: "token";
  status: "queued" | "paid";
  network: string;
  createdAt: string;
}

@Injectable()
export class BlockchainService {
  readonly network = process.env.TON_NETWORK ?? "testnet";
  private readonly claims = new Map<string, ClaimRecord>();

  tonConfig() {
    return {
      mode: "telegram-ton",
      network: this.network,
      treasuryAddress: process.env.TON_TREASURY_ADDRESS ?? null,
      minClaim: 1,
      exchangeRate: {
        goldPerToken: 25
      }
    };
  }

  queueTonReward(playerId = "unknown", walletAddress = "unconnected", amount = 0): ClaimRecord {
    const claim: ClaimRecord = {
      claimId: `ton_${randomUUID()}`,
      playerId,
      walletAddress,
      amount: Math.max(0, Math.floor(amount)),
      currency: "token",
      status: "queued",
      network: this.network,
      createdAt: new Date().toISOString()
    };

    this.claims.set(claim.claimId, claim);
    return claim;
  }

  createLightningInvoice(playerId = "unknown", sats = 1000, memo = "Arena entry") {
    const invoiceId = `ln_${randomUUID()}`;
    return {
      invoiceId,
      playerId,
      sats: Math.max(1, Math.floor(sats)),
      memo,
      paymentRequest: `lnbc${Math.max(1, Math.floor(sats))}n1devplaceholder${invoiceId.replaceAll("-", "")}`,
      status: "pending",
      enabled: Boolean(process.env.LIGHTNING_NODE_URL)
    };
  }
}
