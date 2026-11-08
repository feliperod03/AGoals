import type { Objetivo } from '@/types/objetivo'
import { get } from './client'

export function getObjetivos(): Promise<Objetivo[]> {
  return get<Objetivo[]>('/api/objetivos')
}
