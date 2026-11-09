package com.agoals.tarea;

/** Qué hacer con las subtareas al borrar una tarea que las tiene. Sin elección (null) el borrado responde 409. */
public enum ModoSubtareas {
	BORRAR, CONSERVAR;

	/** Acepta el texto del query param (sin distinguir mayúsculas); null o vacío = sin elección (null). */
	public static ModoSubtareas desde(String texto) {
		if (texto == null || texto.isBlank()) {
			return null;
		}
		return switch (texto.trim().toLowerCase()) {
			case "borrar" -> BORRAR;
			case "conservar" -> CONSERVAR;
			default -> throw new TareaInvalidaException("subtareas inválido: '" + texto + "' (use borrar o conservar)");
		};
	}
}
