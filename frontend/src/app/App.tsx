import { Route, Routes } from 'react-router-dom'

import { CalendarioPage } from '@/features/calendario/CalendarioPage'
import { CofrePage } from '@/features/cofre/CofrePage'
import { HoyPage } from '@/features/agenda/HoyPage'
import { IdeasPage } from '@/features/ideas/IdeasPage'
import { ObjetivoPage } from '@/features/objetivos/ObjetivoPage'
import { ObjetivosPage } from '@/features/objetivos/ObjetivosPage'
import { ProyectoPage } from '@/features/proyectos/ProyectoPage'
import { ProyectosPage } from '@/features/proyectos/ProyectosPage'
import { LoginPage } from '@/features/sesion/LoginPage'
import { RequiereSesion } from '@/features/sesion/RequiereSesion'
import { VigiaSesion } from '@/features/sesion/VigiaSesion'
import { Layout } from './Layout'
import { Proximamente } from './Proximamente'

export function App() {
  return (
    <>
      <VigiaSesion />
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          element={
            <RequiereSesion>
              <Layout />
            </RequiereSesion>
          }
        >
          <Route index element={<HoyPage />} />
          <Route path="cofre" element={<CofrePage />} />
          <Route path="calendario" element={<CalendarioPage />} />
          <Route path="proyectos" element={<ProyectosPage />} />
          <Route path="proyectos/:id" element={<ProyectoPage />} />
          <Route path="objetivos" element={<ObjetivosPage />} />
          <Route path="objetivos/:id" element={<ObjetivoPage />} />
          <Route path="ideas" element={<IdeasPage />} />
          <Route path="*" element={<Proximamente titulo="No encontrada" />} />
        </Route>
      </Routes>
    </>
  )
}
