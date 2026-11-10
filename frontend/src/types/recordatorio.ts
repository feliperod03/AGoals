// Lo que se lee de RecordatorioResponse. No trae el título de la tarea o evento: solo sus ids.

export type Canal = 'APP' | 'CORREO'

export interface Recordatorio {
  id: number
  tareaId: number | null
  eventoId: number | null
  fechaHora: string
  canal: Canal
  enviado: boolean
  descripcion: string | null
}

/**
 * Cuerpo de POST/PUT /api/recordatorios (RecordatorioRequest). El PUT reemplaza todo: hay que reenviar
 * los cinco campos. `fechaHora` va como ISO con desfase. Desde la interfaz solo se manda `'APP'`.
 */
export interface RecordatorioRequest {
  tareaId: number | null
  eventoId: number | null
  fechaHora: string
  canal: Canal
  descripcion: string
}
