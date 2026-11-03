package com.agoals;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AGoalsApplication {

	// Java en Windows reporta la zona como "America/Buenos_Aires" (nombre antiguo) y el
	// PostgreSQL de Docker no lo reconoce. Se usa el nombre canónico antes de abrir conexiones.
	// El bloque estático también corre al ejecutar los tests.
	static {
		TimeZone.setDefault(TimeZone.getTimeZone("America/Argentina/Buenos_Aires"));
	}

	public static void main(String[] args) {
		SpringApplication.run(AGoalsApplication.class, args);
	}

}
