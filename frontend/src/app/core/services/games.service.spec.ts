import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GamesService } from './games.service';

describe('GamesService (Milestone 14 endpoints)', () => {
  let service: GamesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GamesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GETs the current article', () => {
    service.getArticle('g1').subscribe();
    const req = http.expectOne('/api/games/g1/article');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('POSTs a move with toPageId and the expected version', () => {
    service.move('g1', 555, 6).subscribe();
    const req = http.expectOne('/api/games/g1/moves');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ toPageId: 555, version: 6 });
    req.flush({});
  });

  it('POSTs a backtrack with the expected version only', () => {
    service.backtrack('g1', 6).subscribe();
    const req = http.expectOne('/api/games/g1/backtrack');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ version: 6 });
    req.flush({});
  });
});
