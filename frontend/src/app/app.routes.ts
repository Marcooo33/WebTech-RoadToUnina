import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
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
    title: 'Log in · ROADTOUNINA',
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
    title: 'Register · ROADTOUNINA',
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
    title: 'New game · ROADTOUNINA',
  },
  {
    path: 'game/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/game/game-page/game-page').then((m) => m.GamePage),
    canDeactivate: [(component: GamePage) => component.pauseBeforeLeave()],
    title: 'Game · ROADTOUNINA',
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./features/history/history-list/history-list').then((m) => m.HistoryList),
    title: 'History · ROADTOUNINA',
  },
  {
    path: 'history/:gameId',
    loadComponent: () =>
      import('./features/history/history-detail/history-detail').then((m) => m.HistoryDetail),
    title: 'Completed game · ROADTOUNINA',
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile-page/profile-page').then((m) => m.ProfilePage),
    title: 'Profile · ROADTOUNINA',
  },
  {
    path: '**',
    loadComponent: () => import('./shared/components/not-found/not-found').then((m) => m.NotFound),
    title: 'Not found · ROADTOUNINA',
  },
];
