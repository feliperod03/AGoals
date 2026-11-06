package com.agoals.objetivo;

public class ObjetivoNoEncontradoException extends RuntimeException {

	public ObjetivoNoEncontradoException(Long id) {
		super("No existe el objetivo con id " + id);
	}
}
