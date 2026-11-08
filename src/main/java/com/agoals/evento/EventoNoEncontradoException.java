package com.agoals.evento;

public class EventoNoEncontradoException extends RuntimeException {

	public EventoNoEncontradoException(Long id) {
		super("No existe el evento con id " + id);
	}
}
