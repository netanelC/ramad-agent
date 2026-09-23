import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getActiveRoutineTrigger } from '../../src/cron/scheduler.js';

describe('getActiveRoutineTrigger', () => {
  describe('Daily Focus ("בוקר")', () => {
    it('should match direct morning triggers', () => {
      assert.equal(getActiveRoutineTrigger('בוקר'), 'daily_focus');
      assert.equal(getActiveRoutineTrigger('בוקר טוב'), 'daily_focus');
      assert.equal(getActiveRoutineTrigger('מיקוד'), 'daily_focus');
      assert.equal(getActiveRoutineTrigger('מיקוד יומי'), 'daily_focus');
      assert.equal(getActiveRoutineTrigger('הודעת בוקר'), 'daily_focus');
      assert.equal(getActiveRoutineTrigger('daily'), 'daily_focus');
      assert.equal(getActiveRoutineTrigger('morning'), 'daily_focus');
    });

    it('should match natural request phrases', () => {
      assert.equal(getActiveRoutineTrigger('תן לי מיקוד יומי'), 'daily_focus');
      assert.equal(getActiveRoutineTrigger('הפק מיקוד יומי'), 'daily_focus');
      assert.equal(getActiveRoutineTrigger('שלח לי הודעת בוקר'), 'daily_focus');
    });
  });

  describe('Sunday Weekly Brief ("תחילת שבוע")', () => {
    it('should match direct start of week triggers', () => {
      assert.equal(getActiveRoutineTrigger('תחילת שבוע'), 'weekly_opening');
      assert.equal(getActiveRoutineTrigger('פתיחת שבוע'), 'weekly_opening');
      assert.equal(getActiveRoutineTrigger('שבוע טוב'), 'weekly_opening');
      assert.equal(getActiveRoutineTrigger('תכנון שבועי'), 'weekly_opening');
      assert.equal(getActiveRoutineTrigger('sunday'), 'weekly_opening');
      assert.equal(getActiveRoutineTrigger('weekly start'), 'weekly_opening');
    });

    it('should match natural request phrases', () => {
      assert.equal(getActiveRoutineTrigger('תן לי פתיחת שבוע'), 'weekly_opening');
      assert.equal(getActiveRoutineTrigger('שלח לי תכנון שבועי'), 'weekly_opening');
    });
  });

  describe('Weekend Retro ("סופ\"ש")', () => {
    it('should match direct weekend retro triggers with or without quotes', () => {
      assert.equal(getActiveRoutineTrigger('סופ"ש'), 'weekly_retro');
      assert.equal(getActiveRoutineTrigger('סופש'), 'weekly_retro');
      assert.equal(getActiveRoutineTrigger('סוף שבוע'), 'weekly_retro');
      assert.equal(getActiveRoutineTrigger('סגירת שבוע'), 'weekly_retro');
      assert.equal(getActiveRoutineTrigger('מבט במראה'), 'weekly_retro');
      assert.equal(getActiveRoutineTrigger('רטרו'), 'weekly_retro');
      assert.equal(getActiveRoutineTrigger('רטרו שבועי'), 'weekly_retro');
      assert.equal(getActiveRoutineTrigger('סיכום שבוע'), 'weekly_retro');
      assert.equal(getActiveRoutineTrigger('weekend'), 'weekly_retro');
      assert.equal(getActiveRoutineTrigger('retro'), 'weekly_retro');
    });

    it('should match natural request phrases', () => {
      assert.equal(getActiveRoutineTrigger('תן לי סגירת שבוע'), 'weekly_retro');
      assert.equal(getActiveRoutineTrigger('שלח לי רטרו שבועי'), 'weekly_retro');
      assert.equal(getActiveRoutineTrigger('הפק מבט במראה'), 'weekly_retro');
    });
  });

  describe('Non-routine ordinary messages', () => {
    it('should return null for regular questions and commands', () => {
      assert.equal(getActiveRoutineTrigger(''), null);
      assert.equal(getActiveRoutineTrigger('   '), null);
      assert.equal(getActiveRoutineTrigger('מה המשימות הפתוחות?'), null);
      assert.equal(getActiveRoutineTrigger('האם החייל מגיע מחר בבוקר?'), null);
      assert.equal(getActiveRoutineTrigger('צור משימה לצוות קסבה'), null);
      assert.equal(getActiveRoutineTrigger('סגור משימה 4'), null);
      assert.equal(getActiveRoutineTrigger('דחה משימה 2 לשבוע הבא'), null);
    });
  });
});
