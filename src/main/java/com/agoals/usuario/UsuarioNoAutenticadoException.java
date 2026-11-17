package com.agoals.usuario;

public class UsuarioNoAutenticadoException extends RuntimeException {

	public UsuarioNoAutenticadoException() {
		super("Inicia sesión para continuar");
	}
}
