import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameHud } from './game-hud';

describe('GameHud', () => {
  let component: GameHud;
  let fixture: ComponentFixture<GameHud>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameHud],
    }).compileComponents();

    fixture = TestBed.createComponent(GameHud);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('game', {
      mode: 'CLICK',
      difficulty: 'EASY',
      clickCount: 0,
      backtrackCount: 0,
      path: [{ pageId: 1, title: 'Start' }],
    });
    fixture.componentRef.setInput('displayTimeMs', 0);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
