package com.agoals.serie;

/** La operación no corresponde al estado actual (p. ej. "toda la serie" sobre un evento suelto): se responde 409. */
public class SerieEventoConflictoException extends RuntimeException {

	public SerieEventoConflictoException(String mensaje) {
		super(mensaje);
	}
}
