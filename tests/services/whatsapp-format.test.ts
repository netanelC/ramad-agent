import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatTextForWhatsApp } from '../../src/services/whatsapp.service.js';

describe('formatTextForWhatsApp', () => {
  it('should convert Markdown headers to WhatsApp bold text', () => {
    const input = '### מבט במראה';
    const output = formatTextForWhatsApp(input);
    assert.equal(output, '*מבט במראה*');
  });

  it('should convert double asterisks to single asterisks', () => {
    const input = 'זהו **טקסט מודגש** בתוך הודעה';
    const output = formatTextForWhatsApp(input);
    assert.equal(output, 'זהו *טקסט מודגש* בתוך הודעה');
  });

  it('should handle empty or whitespace text gracefully', () => {
    assert.equal(formatTextForWhatsApp(''), '');
  });
});
