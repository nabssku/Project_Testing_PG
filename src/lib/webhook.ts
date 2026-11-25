import crypto from "node:crypto";

export function isWebhookTokenConfigured(): boolean {
  return Boolean(process.env.BORDERPAY_WEBHOOK_TOKEN?.trim());
}

export function verifyWebhookToken(receivedToken: string | null): boolean {
  const expected = process.env.BORDERPAY_WEBHOOK_TOKEN?.trim();
  if (!expected || !receivedToken) return false;

  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(receivedToken, "utf8");

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export function maskSecretToken(token: string | null): string | null {
  if (!token) return null;
  if (token.length <= 10) return "••••••";
  return `${token.slice(0, 6)}••••${token.slice(-4)}`;
}
