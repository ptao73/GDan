import { describe, expect, it } from 'vitest';
import { isImageFile } from '../useHistory.js';

describe('useHistory import mode helpers', () => {
  it('recognizes image MIME types and supported image extensions', () => {
    expect(isImageFile({ type: 'image/png', name: 'hand.bin' })).toBe(true);
    expect(isImageFile({ type: '', name: 'hand.JPEG' })).toBe(true);
    expect(isImageFile({ type: '', name: 'hand.heic' })).toBe(true);
  });

  it('does not classify JSON or missing files as images', () => {
    expect(isImageFile({ type: 'application/json', name: 'hand.json' })).toBe(false);
    expect(isImageFile({ type: 'text/plain', name: 'hand.txt' })).toBe(false);
    expect(isImageFile(null)).toBe(false);
  });
});
