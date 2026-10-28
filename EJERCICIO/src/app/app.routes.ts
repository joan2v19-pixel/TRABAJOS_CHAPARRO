import { Routes } from '@angular/router';
import { GestionSena } from './Componentes/gestion-sena/gestion-sena';

export const routes: Routes = [
    {
        path: '',
        component: GestionSena,
        pathMatch: 'full'
    }
];
