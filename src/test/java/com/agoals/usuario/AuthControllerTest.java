package com.agoals.usuario;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.common.UsuarioActual;
import com.agoals.usuario.dto.LoginRequest;
import com.agoals.usuario.dto.UsuarioResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false) // los filtros se prueban en SeguridadIntegracionTest
@Import(ApiExceptionHandler.class)
class AuthControllerTest {

	@Autowired
	MockMvc mvc;

	@MockitoBean
	SesionService sesionService;

	@MockitoBean
	UsuarioService usuarioService;

	@MockitoBean
	UsuarioActual usuarioActual;

	@Test
	void loginValidoDevuelve200ConElUsuario() throws Exception {
		when(sesionService.iniciar(any(LoginRequest.class), any(), any()))
				.thenReturn(new UsuarioResponse(1L, "yo", "yo@agoals.local"));

		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"yo@agoals.local\",\"clave\":\"secreta\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.nombreUsuario").value("yo"))
				.andExpect(jsonPath("$.email").value("yo@agoals.local"));
	}

	@Test
	void loginSinEmailDevuelve400() throws Exception {
		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"\",\"clave\":\"secreta\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errores[0]").value(org.hamcrest.Matchers.containsString("email")));
		verifyNoInteractions(sesionService);
	}

	@Test
	void loginConCredencialesMalasDevuelve401ConMensajeGenerico() throws Exception {
		when(sesionService.iniciar(any(LoginRequest.class), any(), any())).thenThrow(new CredencialesInvalidasException());

		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"a@x.com\",\"clave\":\"mala\"}"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.mensaje").value("Email o contraseña incorrectos"));
	}

	@Test
	void loginBloqueadoDevuelve429ConRetryAfterYElMensaje() throws Exception {
		when(sesionService.iniciar(any(LoginRequest.class), any(), any())).thenThrow(new LoginBloqueadoException(600));

		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"a@x.com\",\"clave\":\"mala\"}"))
				.andExpect(status().isTooManyRequests())
				.andExpect(header().string("Retry-After", "600"))
				.andExpect(jsonPath("$.mensaje").value("Demasiados intentos fallidos. Espera 10 minutos y vuelve a intentarlo."));
	}

	@Test
	void recordarmeLlegaAlServiceYVaTrueSoloSiSeEnvia() throws Exception {
		when(sesionService.iniciar(any(LoginRequest.class), any(), any()))
				.thenReturn(new UsuarioResponse(1L, "yo", "yo@agoals.local"));
		ArgumentCaptor<LoginRequest> captor = ArgumentCaptor.forClass(LoginRequest.class);

		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"yo@agoals.local\",\"clave\":\"secreta\"}")).andExpect(status().isOk());
		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"yo@agoals.local\",\"clave\":\"secreta\",\"recordarme\":true}")).andExpect(status().isOk());

		verify(sesionService, times(2)).iniciar(captor.capture(), any(), any());
		assertThat(captor.getAllValues().get(0).recordar()).isFalse();
		assertThat(captor.getAllValues().get(1).recordar()).isTrue();
	}

	@Test
	void unEmailDeMasDe255CaracteresDevuelve400() throws Exception {
		String largo = "a".repeat(250) + "@x.com";

		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"" + largo + "\",\"clave\":\"secreta\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errores[0]").value(org.hamcrest.Matchers.containsString("demasiado largo")));
		verifyNoInteractions(sesionService);
	}

	@Test
	void yoDevuelveElUsuarioActual() throws Exception {
		when(usuarioActual.id()).thenReturn(7L);
		when(usuarioService.buscar(7L)).thenReturn(new UsuarioResponse(7L, "ana", "ana@x.com"));

		mvc.perform(get("/api/auth/yo"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(7))
				.andExpect(jsonPath("$.email").value("ana@x.com"));
	}

	@Test
	void yoSinSesionDevuelve401() throws Exception {
		when(usuarioActual.id()).thenThrow(new UsuarioNoAutenticadoException());

		mvc.perform(get("/api/auth/yo"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.mensaje").value("Inicia sesión para continuar"));
	}
}
