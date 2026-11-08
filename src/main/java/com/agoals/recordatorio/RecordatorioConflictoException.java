package com.agoals.recordatorio;

/** La tarea o el evento ya tiene un recordatorio (máximo uno por cada uno): se responde 409. */
public class RecordatorioConflictoException extends RuntimeException {

	public RecordatorioConflictoException(String mensaje) {
		super(mensaje);
	}
}
