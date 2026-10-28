import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GestionSena } from './gestion-sena';

describe('GestionSena', () => {
  let component: GestionSena;
  let fixture: ComponentFixture<GestionSena>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionSena],
    }).compileComponents();

    fixture = TestBed.createComponent(GestionSena);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
