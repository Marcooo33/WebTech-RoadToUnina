import { DatePipe, DecimalPipe } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import { appConfig } from './app.config';

describe('Italian locale configuration', () => {
  it('uses Italian dates and decimal separators independently of the browser language', () => {
    expect(appConfig.providers).toContainEqual({ provide: LOCALE_ID, useValue: 'it-IT' });
    expect(new DatePipe('it-IT').transform('2026-10-27T12:34:00Z', 'mediumDate', 'UTC')).toBe(
      '27 ott 2026',
    );
    expect(new DecimalPipe('it-IT').transform(12.5)).toBe('12,5');
  });
});
