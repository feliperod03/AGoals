/** Sin mayúsculas ni tildes, para comparar textos: "accion" encuentra "Acción". */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
