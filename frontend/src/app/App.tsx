import { Route, Routes } from 'react-router-dom'

import { CofrePage } from '@/features/cofre/CofrePage'
import { HoyPage } from '@/features/agenda/HoyPage'
import { Layout } from './Layout'
import { Proximamente } from './Proximamente'
import { useTema } from './useTema'

export function App() {
  useTema()

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HoyPage />} />
        <Route path="cofre" element={<CofrePage />} />
        <Route path="calendario" element={<Proximamente titulo="Calendario" />} />
        <Route path="proyectos" element={<Proximamente titulo="Proyectos" />} />
        <Route path="objetivos" element={<Proximamente titulo="Objetivos" />} />
        <Route path="ideas" element={<Proximamente titulo="Ideas" />} />
        <Route path="*" element={<Proximamente titulo="No encontrada" />} />
      </Route>
    </Routes>
  )
}
