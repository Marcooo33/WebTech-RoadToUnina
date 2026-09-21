import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WikipediaArticle } from './wikipedia-article';

describe('WikipediaArticle', () => {
  let component: WikipediaArticle;
  let fixture: ComponentFixture<WikipediaArticle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WikipediaArticle],
    }).compileComponents();

    fixture = TestBed.createComponent(WikipediaArticle);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
