import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sheetsService } from '../../src/services/sheets.service.js';

describe('Task Creation Guardrails', () => {
  it('should reject task creation when title is empty', async () => {
    const result = await sheetsService.createTask({
      title: '',
      team: 'קסבה',
      tgb: '2026-10-01',
      priority: 'P1',
    });
    assert.match(result, /חסרה כותרת/);
  });

  it('should reject task creation when team is missing', async () => {
    const result = await sheetsService.createTask({
      title: 'הטמעת פיצ׳ר חדש',
      team: '',
      tgb: '2026-10-01',
      priority: 'P1',
    });
    assert.match(result, /חובה להגדיר צוות ותאריך גמר ביצוע/);
  });

  it('should reject task creation when tgb is missing', async () => {
    const result = await sheetsService.createTask({
      title: 'הטמעת פיצ׳ר חדש',
      team: 'טטריס',
      tgb: '',
      priority: 'P2',
    });
    assert.match(result, /חובה להגדיר צוות ותאריך גמר ביצוע/);
  });
});
