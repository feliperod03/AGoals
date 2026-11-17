package com.agoals.usuario;

import com.agoals.usuario.dto.LoginRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** El orden y las decisiones de SesionService: freno, autenticación y remember-me solo a pedido. */
class SesionServiceTest {

	private AuthenticationManager authManager;
	private RecordarmeServices recordarme;
	private FrenoDeLogin freno;
	private SesionService servicio;
	private MockHttpServletRequest request;
	private MockHttpServletResponse response;
	private Authentication autenticado;

	@BeforeEach
	void preparar() {
		authManager = mock(AuthenticationManager.class);
		recordarme = mock(RecordarmeServices.class);
		// Umbral de 2 fallos por par para poder bloquear rápido.
		freno = new FrenoDeLogin(new RelojMovible(Instant.parse("2026-11-17T12:00:00Z")), 2, 20, Duration.ofMinutes(15),
				Duration.ofMinutes(15), 100);
		servicio = new SesionService(authManager, mock(SessionAuthenticationStrategy.class),
				mock(SecurityContextRepository.class), freno, recordarme);
		request = new MockHttpServletRequest();
		request.setRemoteAddr("198.51.100.7");
		response = new MockHttpServletResponse();
		autenticado = UsernamePasswordAuthenticationToken
				.authenticated(new UsuarioAutenticado(3L, "ana", "ana@x.com", null), null, List.of());
	}

	@AfterEach
	void limpiar() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void conElFrenoActivoNoSeLlamaAlAuthenticationManager() {
		freno.registrarFallo("198.51.100.7", "ana@x.com");
		freno.registrarFallo("198.51.100.7", "ana@x.com");

		assertThatThrownBy(() -> servicio.iniciar(new LoginRequest(" Ana@x.com ", "clave", null), request, response))
				.isInstanceOf(LoginBloqueadoException.class);

		verifyNoInteractions(authManager);
	}

	@Test
	void unFalloSeRegistraEnElFreno() {
		when(authManager.authenticate(any())).thenThrow(new BadCredentialsException("mal"));
		LoginRequest mala = new LoginRequest("ana@x.com", "mala", null);

		assertThatThrownBy(() -> servicio.iniciar(mala, request, response)).isInstanceOf(CredencialesInvalidasException.class);
		assertThatThrownBy(() -> servicio.iniciar(mala, request, response)).isInstanceOf(CredencialesInvalidasException.class);
		// El segundo fallo llegó al umbral de 2: el tercer intento ya ni autentica.
		assertThatThrownBy(() -> servicio.iniciar(mala, request, response)).isInstanceOf(LoginBloqueadoException.class);
	}

	@Test
	void sinRecordarmeSeOlvidaElDispositivoYNoHayLoginSuccess() {
		when(authManager.authenticate(any())).thenReturn(autenticado);

		var respuesta = servicio.iniciar(new LoginRequest("ana@x.com", "clave", false), request, response);

		assertThat(respuesta.id()).isEqualTo(3L);
		verify(recordarme).olvidarDispositivo(request, response);
		verify(recordarme, never()).loginSuccess(any(), any(), any());
	}

	@Test
	void conRecordarmeSeActivaElRememberMeConElAuthentication() {
		when(authManager.authenticate(any())).thenReturn(autenticado);

		servicio.iniciar(new LoginRequest("ana@x.com", "clave", true), request, response);

		verify(recordarme).olvidarDispositivo(request, response);
		verify(recordarme).loginSuccess(request, response, autenticado);
	}
}
