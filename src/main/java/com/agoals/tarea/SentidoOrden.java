package com.agoals.tarea;

/** Sentido del orden de la recomendación. Por defecto DESC. */
public enum SentidoOrden {
	DESC, ASC;

	/** Acepta el texto del query param (sin distinguir mayúsculas); null o vacío = valor por defecto. */
	public static SentidoOrden desde(String texto) {
		if (texto == null || texto.isBlank()) {
			return DESC;
		}
		return switch (texto.trim().toLowerCase()) {
			case "desc" -> DESC;
			case "asc" -> ASC;
			default -> throw new TareaInvalidaException("sentido inválido: '" + texto + "' (use desc o asc)");
		};
	}
}
