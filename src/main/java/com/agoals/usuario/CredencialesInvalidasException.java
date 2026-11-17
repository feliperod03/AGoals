package com.agoals.usuario;

/** Mismo mensaje para "contraseña mala" y "email inexistente": no revela si el email existe. */
public class CredencialesInvalidasException extends RuntimeException {

	public CredencialesInvalidasException() {
		super("Email o contraseña incorrectos");
	}
}
