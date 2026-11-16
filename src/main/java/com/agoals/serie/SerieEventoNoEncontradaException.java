package com.agoals.serie;

/** La serie pedida no existe: se responde 404. */
public class SerieEventoNoEncontradaException extends RuntimeException {

	public SerieEventoNoEncontradaException(Long id) {
		super("Serie no encontrada: " + id);
	}
}
