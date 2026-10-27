import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GamePath } from './game-path';

describe('GamePath', () => {
  let fixture: ComponentFixture<GamePath>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GamePath] }).compileComponents();
    fixture = TestBed.createComponent(GamePath);
    fixture.componentRef.setInput('path', [
      { pageId: 1, title: 'Roma' },
      { pageId: 2, title: 'Università degli Studi di Napoli Federico II' },
      { pageId: 1, title: 'Roma' },
    ]);
    fixture.detectChanges();
  });

  it('preserves all real titles and repeated visits as a read-only sequence', () => {
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.path__title')).map(
      (title) => (title as HTMLElement).textContent,
    );
    expect(titles).toEqual(['Roma', 'Università degli Studi di Napoli Federico II', 'Roma']);
    expect(fixture.nativeElement.querySelector('a, button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.path__item').textContent).toContain(
      'Voce iniziale',
    );
    expect(fixture.nativeElement.querySelector('.path__item--current').textContent).toContain(
      'Voce attuale',
    );
  });

  it('names the reached destination in the completed variant', () => {
    fixture.componentRef.setInput('lastLabel', 'target');
    fixture.componentRef.setInput('ariaLabel', 'Percorso completato');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.path').getAttribute('aria-label')).toBe(
      'Percorso completato',
    );
    expect(fixture.nativeElement.querySelector('.path__item--current').textContent).toContain(
      'Destinazione',
    );
    expect(fixture.componentInstance.path().length).toBe(3);
  });
});
