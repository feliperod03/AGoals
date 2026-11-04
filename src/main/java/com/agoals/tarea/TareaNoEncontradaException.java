package com.agoals.tarea;

public class TareaNoEncontradaException extends RuntimeException {

	public TareaNoEncontradaException(Long id) {
		super("No existe la tarea con id " + id);
	}
}
