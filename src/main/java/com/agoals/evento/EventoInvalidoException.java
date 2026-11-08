package com.agoals.evento;

/** Regla de negocio o combinación de datos inválida en una petición: se responde 400. */
public class EventoInvalidoException extends RuntimeException {

	public EventoInvalidoException(String mensaje) {
		super(mensaje);
	}
}
