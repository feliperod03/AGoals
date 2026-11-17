package com.agoals.usuario;

/** Demasiados intentos fallidos: el login responde 429 sin consultar la base. */
public class LoginBloqueadoException extends RuntimeException {

	private final long segundos;

	public LoginBloqueadoException(long segundos) {
		super(mensaje(segundos));
		this.segundos = segundos;
	}

	/** Segundos que faltan para poder reintentar (va en la cabecera Retry-After). */
	public long getSegundos() {
		return segundos;
	}

	static String mensaje(long segundos) {
		long minutos = Math.max(1, (segundos + 59) / 60);
		return "Demasiados intentos fallidos. Espera " + minutos + (minutos == 1 ? " minuto" : " minutos")
				+ " y vuelve a intentarlo.";
	}
}
