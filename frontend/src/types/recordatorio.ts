// Lo que se lee de RecordatorioResponse. No trae el título de la tarea o evento: solo sus ids.

export interface Recordatorio {
  id: number
  tareaId: number | null
  eventoId: number | null
  fechaHora: string
  enviado: boolean
  descripcion: string | null
}
