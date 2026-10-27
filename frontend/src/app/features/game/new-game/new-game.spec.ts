import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { NewGame } from './new-game';
import { GamesService } from '../../../core/services/games.service';
import { ApiError } from '../../../shared/models/api-error.model';

describe('NewGame', () => {
  let component: NewGame;
  let fixture: ComponentFixture<NewGame>;
  let create: ReturnType<typeof vi.fn>;
  let request: Subject<never>;

  beforeEach(async () => {
    request = new Subject();
    create = vi.fn(() => request);
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: GamesService, useValue: { create } }],
      imports: [NewGame],
    }).compileComponents();
    fixture = TestBed.createComponent(NewGame);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('retains two named native radio groups and the CLICK/EASY defaults', () => {
    expect(component.form.getRawValue()).toEqual({ mode: 'CLICK', difficulty: 'EASY' });
    const legends = Array.from(fixture.nativeElement.querySelectorAll('legend')).map((legend) =>
      (legend as HTMLElement).textContent?.trim(),
    );
    expect(legends).toEqual(['Modalità', 'Difficoltà']);
    expect(fixture.nativeElement.querySelectorAll('input[type="radio"]').length).toBe(5);
    expect(fixture.nativeElement.querySelector('#difficulty-note').textContent).toContain(
      'Tornare indietro non viene mai conteggiato come click di navigazione.',
    );
  });

  it('submits selections from the original native radio controls', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.option')) as HTMLElement[];
    for (const title of ['Tempo', 'Media']) {
      labels
        .find((label) => label.querySelector('.option__title')?.textContent?.trim() === title)!
        .querySelector('input')!
        .click();
    }
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();
    expect(create).toHaveBeenCalledExactlyOnceWith('TIME', 'MEDIUM');
    expect(fixture.nativeElement.querySelector('form').getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
  });

  it('renders the real limit error once with its existing dashboard recovery link', () => {
    component.submit();
    request.error(new ApiError(409, 'GAME_LIMIT_REACHED', 'The maximum number of games is 10.'));
    fixture.detectChanges();
    const alerts = fixture.nativeElement.querySelectorAll('[role="alert"]');
    expect(alerts.length).toBe(1);
    expect(alerts[0].textContent).toContain('The maximum number of games is 10.');
    expect(alerts[0].querySelector('a').getAttribute('href')).toBe('/');
    expect(fixture.nativeElement.querySelector('app-error-banner')).toBeNull();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
  });

  it('keeps other server errors in the shared error banner', () => {
    component.submit();
    request.error(
      new ApiError(502, 'WIKIPEDIA_UNAVAILABLE', 'Wikipedia è temporaneamente non disponibile.'),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[role="alert"]').length).toBe(1);
    expect(
      fixture.nativeElement.querySelector('app-error-banner [role="alert"]').textContent,
    ).toContain('Wikipedia è temporaneamente non disponibile.');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(false);
  });
});
