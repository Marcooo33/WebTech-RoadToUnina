import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { NewGame } from './new-game';

describe('NewGame', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<NewGame>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewGame],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { clearUser: vi.fn() } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NewGame);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('offers both modes and all three difficulties', () => {
    const el = fixture.nativeElement as HTMLElement;
    const radios = el.querySelectorAll('input[type=radio]');
    expect(radios).toHaveLength(5);

    const titles = Array.from(el.querySelectorAll('.option__title')).map((n) =>
      n.textContent?.trim(),
    );
    expect(titles).toEqual(['CLICK', 'TIME', 'EASY', 'MEDIUM', 'HARD']);
  });

  it('creates a game with the selected mode/difficulty and navigates to it', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.form.setValue({ mode: 'TIME', difficulty: 'HARD' });

    fixture.componentInstance.submit();

    const req = http.expectOne('/api/games');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mode: 'TIME', difficulty: 'HARD' });
    req.flush({ id: 'g1' });

    expect(navigate).toHaveBeenCalledWith(['/game', 'g1']);
  });

  it('surfaces the backend message when the in-progress game limit is reached', () => {
    fixture.componentInstance.submit();

    http.expectOne('/api/games').flush(
      {
        error: {
          code: 'GAME_LIMIT_REACHED',
          message: 'You already have 10 games in progress.',
        },
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('You already have 10 games in progress.');
    expect(el.textContent).toContain('Finish or delete one');
    expect(fixture.componentInstance.limitReached).toBe(true);
  });
});
