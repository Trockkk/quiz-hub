import { lazy } from 'react'
import type { GameDefinition } from '../types'
import { bank } from './bank'

export const quizGame: GameDefinition = {
  id: 'quiz',
  title: 'Culture Générale',
  tagline: 'QCM chronométrés : répondez juste et vite pour maximiser votre score.',
  icon: '🧠',
  color: '#8b5cf6',
  modes: [
    { id: 'all', label: 'Toutes catégories', icon: '✨', color: '#8b5cf6' },
    ...bank.categories.map((c) => ({ id: c.id, label: c.label, icon: c.icon, color: c.color })),
  ],
  component: lazy(() => import('./QuizGame')),
}
