import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectImageType } from "../lib/image-upload";

const pad = (bytes: number[]) => Uint8Array.from([...bytes, ...new Array(16).fill(0)]);

describe("detectImageType", () => {
  it("recognises PNG, JPEG, GIF and WebP by their signatures", () => {
    assert.equal(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
    assert.equal(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(detectImageType(pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), "image/gif");
    assert.equal(detectImageType(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "image/webp");
  });

  it("rejects SVG, HTML, WAV-in-RIFF, empty and tiny input", () => {
    const text = (value: string) => new TextEncoder().encode(value.padEnd(32, " "));
    assert.equal(detectImageType(text("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null);
    assert.equal(detectImageType(text("<html><script>alert(1)</script></html>")), null);
    assert.equal(detectImageType(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])), null);
    assert.equal(detectImageType(new Uint8Array()), null);
    assert.equal(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff])), null);
  });
});
