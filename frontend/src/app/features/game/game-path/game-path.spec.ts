import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GamePath } from './game-path';

describe('GamePath', () => {
  let component: GamePath;
  let fixture: ComponentFixture<GamePath>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamePath],
    }).compileComponents();

    fixture = TestBed.createComponent(GamePath);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('path', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
