import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageRef } from '../../../shared/models/game.model';
import { GamePath } from './game-path';

describe('GamePath', () => {
  let fixture: ComponentFixture<GamePath>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GamePath] }).compileComponents();
    fixture = TestBed.createComponent(GamePath);
  });

  function render(path: PageRef[]): HTMLElement {
    fixture.componentRef.setInput('path', path);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the path in order and marks the last node as current', () => {
    const el = render([
      { pageId: 1, title: 'Start' },
      { pageId: 2, title: 'Middle' },
      { pageId: 3, title: 'Current' },
    ]);

    const items = Array.from(el.querySelectorAll('.path__item'));
    expect(items.map((n) => n.querySelector('.path__title')?.textContent?.trim())).toEqual([
      'Start',
      'Middle',
      'Current',
    ]);
    expect(items[2].classList.contains('path__item--current')).toBe(true);
    expect(items[0].classList.contains('path__item--current')).toBe(false);
    expect(el.querySelectorAll('.path__badge')).toHaveLength(1);
  });
});
