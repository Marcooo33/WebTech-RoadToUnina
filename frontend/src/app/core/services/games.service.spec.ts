import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GamesService } from './games.service';

describe('GamesService (games endpoints)', () => {
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

  it('POSTs a move with only toTitle (no version)', () => {
    service.move('g1', 'Napoli').subscribe();
    const req = http.expectOne('/api/games/g1/moves');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ toTitle: 'Napoli' });
    req.flush({});
  });

  it('POSTs an empty backtrack body', () => {
    service.backtrack('g1').subscribe();
    const req = http.expectOne('/api/games/g1/backtrack');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('DELETEs a game with no query parameters', () => {
    service.remove('g1').subscribe();
    const req = http.expectOne('/api/games/g1');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(null);
  });

  it('POSTs a minimal heartbeat', () => {
    service.heartbeat('g1').subscribe();
    const req = http.expectOne('/api/games/g1/heartbeat');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
  });
});
