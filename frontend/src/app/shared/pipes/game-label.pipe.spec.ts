import { GameLabelPipe } from './game-label.pipe';

describe('GameLabelPipe', () => {
  it('translates every game enum used in the interface', () => {
    const pipe = new GameLabelPipe();
    expect(
      [
        'CLICK',
        'TIME',
        'EASY',
        'MEDIUM',
        'HARD',
        'IN_PROGRESS',
        'COMPLETED',
        'NAVIGATION',
        'BACKTRACK',
      ].map((value) => pipe.transform(value as Parameters<GameLabelPipe['transform']>[0])),
    ).toEqual([
      'Click',
      'Tempo',
      'Facile',
      'Media',
      'Difficile',
      'In corso',
      'Completata',
      'Navigazione',
      'Ritorno indietro',
    ]);
  });
});
