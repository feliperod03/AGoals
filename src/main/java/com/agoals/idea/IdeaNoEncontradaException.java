package com.agoals.idea;

public class IdeaNoEncontradaException extends RuntimeException {

	public IdeaNoEncontradaException(Long id) {
		super("No existe la idea con id " + id);
	}
}
