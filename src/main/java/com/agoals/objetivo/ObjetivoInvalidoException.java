package com.agoals.objetivo;

/** Regla de negocio o referencia inválida en una petición: se responde 400. */
public class ObjetivoInvalidoException extends RuntimeException {

	public ObjetivoInvalidoException(String mensaje) {
		super(mensaje);
	}
}
