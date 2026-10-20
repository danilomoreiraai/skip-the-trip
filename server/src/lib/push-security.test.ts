import { describe, expect, it } from "vitest";
import {
  allowedPushEndpoint,
  decryptSubscription,
  encryptSubscription,
} from "./push-security.js";

describe("push credentials and outbound destination protection", () => {
  it("allows only known HTTPS push services without credentials, custom ports or fragments", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/test",
      "https://web.push.apple.com/Qtest",
      "https://updates.push.services.mozilla.com/wpush/v2/test",
    ])
      expect(allowedPushEndpoint(endpoint)).toBe(true);
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/test",
      "https://127.0.0.1/test",
      "https://localhost/test",
      "https://fcm.googleapis.com.attacker.test/test",
      "https://secret@fcm.googleapis.com/fcm/send/test",
      "https://fcm.googleapis.com:8443/fcm/send/test",
      "https://web.push.apple.com/Qtest#secret",
      "garbage",
    ])
      expect(allowedPushEndpoint(endpoint)).toBe(false);
  });
  it("encrypts subscription material and refuses tampered or wrong-key ciphertext", () => {
    const key = Buffer.alloc(32, 1).toString("base64");
    const input = {
      endpoint: "https://web.push.apple.com/private",
      keys: { auth: "secret-auth", p256dh: "secret-key" },
    };
    const ciphertext = encryptSubscription(input, key);
    expect(ciphertext).not.toContain("private");
    expect(ciphertext).not.toContain("secret");
    expect(decryptSubscription(ciphertext, key)).toEqual(input);
    expect(() =>
      decryptSubscription(ciphertext, Buffer.alloc(32, 2).toString("base64")),
    ).toThrow();
    expect(() => decryptSubscription(`broken.${ciphertext}`, key)).toThrow();
  });
});
