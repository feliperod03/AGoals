package com.agoals.usuario;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.common.UsuarioActual;
import com.agoals.usuario.dto.LoginRequest;
import com.agoals.usuario.dto.UsuarioResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
