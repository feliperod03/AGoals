package com.agoals.tarea;

/** Criterio de orden de la recomendación. Por defecto PRIORIDAD. */
public enum OrdenRecomendacion {
	PRIORIDAD, ANTIGUEDAD;

	/** Acepta el texto del query param (sin distinguir mayúsculas); null o vacío = valor por defecto. */
	public static OrdenRecomendacion desde(String texto) {
		if (texto == null || texto.isBlank()) {
			return PRIORIDAD;
		}
		return switch (texto.trim().toLowerCase()) {
			case "prioridad" -> PRIORIDAD;
			case "antiguedad" -> ANTIGUEDAD;
			default -> throw new TareaInvalidaException("orden inválido: '" + texto + "' (use prioridad o antiguedad)");
		};
	}
}
