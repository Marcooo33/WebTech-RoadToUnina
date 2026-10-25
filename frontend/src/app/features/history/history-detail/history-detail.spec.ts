import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistoryDetail } from './history-detail';

describe('HistoryDetail', () => {
  let component: HistoryDetail;
  let fixture: ComponentFixture<HistoryDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
      imports: [HistoryDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryDetail);
    fixture.componentRef.setInput('gameId', '00000000-0000-4000-8000-000000000001');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
