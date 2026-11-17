package com.agoals.usuario;

import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.mock.env.MockEnvironment;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ClaveInicialAlArrancarTest {

	private final UsuarioService service = mock(UsuarioService.class);

	private void correr(MockEnvironment env) {
		when(service.fijarCredencialesIniciales(any(), any())).thenReturn(UsuarioService.ResultadoClaveInicial.SIN_VARIABLE);
		new ClaveInicialAlArrancar(service, env).run(new DefaultApplicationArguments());
	}

	@Test
	void conVariablesLasPasaAlService() {
		correr(new MockEnvironment().withProperty("AGOALS_CLAVE_INICIAL", "secreta")
				.withProperty("AGOALS_EMAIL_INICIAL", "a@x.com"));

		verify(service).fijarCredencialesIniciales(Optional.of("secreta"), Optional.of("a@x.com"));
	}

	@Test
	void sinVariablesPasaVacio() {
		correr(new MockEnvironment());

		verify(service).fijarCredencialesIniciales(Optional.empty(), Optional.empty());
	}

	@Test
	void elEmailEsOpcional() {
		correr(new MockEnvironment().withProperty("AGOALS_CLAVE_INICIAL", "secreta"));

		verify(service).fijarCredencialesIniciales(Optional.of("secreta"), Optional.empty());
	}
}
