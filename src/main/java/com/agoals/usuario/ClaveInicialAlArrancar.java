package com.agoals.usuario;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Al arrancar: si AGOALS_CLAVE_INICIAL está definida y el usuario 1 aún no tiene contraseña, la guarda (con
 * AGOALS_EMAIL_INICIAL opcional). Es idempotente y nunca pisa un hash real. Nunca se loguea la contraseña.
 */
@Component
public class ClaveInicialAlArrancar implements ApplicationRunner {

	static final String VARIABLE_CLAVE = "AGOALS_CLAVE_INICIAL";
	static final String VARIABLE_EMAIL = "AGOALS_EMAIL_INICIAL";

	private static final Logger log = LoggerFactory.getLogger(ClaveInicialAlArrancar.class);

	private final UsuarioService usuarioService;
	private final Environment environment;

	public ClaveInicialAlArrancar(UsuarioService usuarioService, Environment environment) {
		this.usuarioService = usuarioService;
		this.environment = environment;
	}

	@Override
	public void run(ApplicationArguments args) {
		UsuarioService.ResultadoClaveInicial resultado = usuarioService.fijarCredencialesIniciales(
				Optional.ofNullable(environment.getProperty(VARIABLE_CLAVE)),
				Optional.ofNullable(environment.getProperty(VARIABLE_EMAIL)));
		switch (resultado) {
			case FIJADA -> log.info("Contraseña inicial del usuario 1 guardada desde {}.", VARIABLE_CLAVE);
			case FIJADA_EMAIL_OCUPADO -> log.warn(
					"Contraseña inicial guardada, pero el email de {} ya lo usa otro usuario: se dejó el anterior.",
					VARIABLE_EMAIL);
			case YA_TENIA_CLAVE -> log.debug("El usuario 1 ya tiene contraseña: no se toca.");
			case SIN_VARIABLE -> log.warn(
					"El usuario 1 aún no tiene contraseña y {} no está definida: no podrás iniciar sesión.", VARIABLE_CLAVE);
			case SIN_USUARIO -> log.warn("No existe el usuario 1: no se guardó la contraseña inicial.");
		}
	}
}
