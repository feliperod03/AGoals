package com.agoals.serie;

/** Regla o combinación de datos inválida al crear o editar una serie: se responde 400. */
public class SerieEventoInvalidaException extends RuntimeException {

	public SerieEventoInvalidaException(String mensaje) {
		super(mensaje);
	}
}
