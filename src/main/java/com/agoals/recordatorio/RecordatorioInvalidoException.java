package com.agoals.recordatorio;

/** Regla de negocio o combinación de datos inválida en una petición: se responde 400. */
public class RecordatorioInvalidoException extends RuntimeException {

	public RecordatorioInvalidoException(String mensaje) {
		super(mensaje);
	}
}
