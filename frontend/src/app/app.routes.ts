import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import type { GamePage } from './features/game/game-page/game-page';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'ROADTOUNINA',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: 'Accedi · ROADTOUNINA',
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
    title: 'Registrati · ROADTOUNINA',
  },
  {
    path: 'dashboard',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'new-game',
    canActivate: [authGuard],
    loadComponent: () => import('./features/game/new-game/new-game').then((m) => m.NewGame),
    title: 'Nuova partita · ROADTOUNINA',
  },
  {
    path: 'game/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/game/game-page/game-page').then((m) => m.GamePage),
    canDeactivate: [(component: GamePage) => component.pauseBeforeLeave()],
    title: 'Partita · ROADTOUNINA',
  },
  {
    path: 'guest/game/:id',
    canActivate: [guestGuard],
    data: { guest: true },
    loadComponent: () => import('./features/game/game-page/game-page').then((m) => m.GamePage),
    canDeactivate: [(component: GamePage) => component.pauseBeforeLeave()],
    title: 'Partita ospite · ROADTOUNINA',
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./features/history/history-list/history-list').then((m) => m.HistoryList),
    title: 'Classifica · ROADTOUNINA',
  },
  {
    path: 'history/:gameId',
    loadComponent: () =>
      import('./features/history/history-detail/history-detail').then((m) => m.HistoryDetail),
    title: 'Partita completata · ROADTOUNINA',
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile-page/profile-page').then((m) => m.ProfilePage),
    title: 'Profilo · ROADTOUNINA',
  },
  {
    path: '**',
    loadComponent: () => import('./shared/components/not-found/not-found').then((m) => m.NotFound),
    title: 'Pagina non trovata · ROADTOUNINA',
  },
];
