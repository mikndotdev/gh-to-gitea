import { createHmac, timingSafeEqual } from "node:crypto";

export type RepositoryCreatedPayload = {
  action: string;
  repository: {
    name: string;
    full_name: string;
    clone_url: string;
    private: boolean;
    description: string | null;
    owner: {
      login: string;
    };
  };
};

export function verifySignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
