package com.agoals.usuario;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UsuarioActualDeSesionTest {

	private final UsuarioActualDeSesion usuarioActual = new UsuarioActualDeSesion();

	@AfterEach
	void limpiar() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void devuelveElIdDelUsuarioAutenticado() {
		var principal = new UsuarioAutenticado(42L, "ana", "ana@x.com", null);
		SecurityContextHolder.getContext().setAuthentication(
				UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()));

		assertThat(usuarioActual.id()).isEqualTo(42L);
	}

	@Test
	void sinAutenticacionLanzaLaExcepcion() {
		SecurityContextHolder.clearContext();

		assertThatThrownBy(usuarioActual::id).isInstanceOf(UsuarioNoAutenticadoException.class);
	}

	@Test
	void unAnonimoLanzaLaExcepcion() {
		SecurityContextHolder.getContext().setAuthentication(
				new AnonymousAuthenticationToken("k", "anonymousUser", AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS")));

		assertThatThrownBy(usuarioActual::id).isInstanceOf(UsuarioNoAutenticadoException.class);
	}
}
