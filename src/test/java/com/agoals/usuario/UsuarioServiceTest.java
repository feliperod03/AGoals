package com.agoals.usuario;

import com.agoals.usuario.UsuarioService.ResultadoClaveInicial;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {

	@Mock
	UsuarioRepository repository;

	@Mock
	PasswordEncoder encoder;

	UsuarioService service;

	@BeforeEach
	void preparar() {
		service = new UsuarioService(repository, encoder);
	}

	private static Usuario usuario(long id, String email, String hash) {
		Usuario u = new Usuario();
		ReflectionTestUtils.setField(u, "id", id);
		u.setNombreUsuario("yo");
		u.setEmail(email);
		u.setContrasenaHash(hash);
		return u;
	}

	// ---------------------------------------------------------------- loadUserByUsername

	@Test
	void loadUserEncuentraPorEmailRecortado() {
		when(repository.findByEmailIgnoreCase("ana@x.com")).thenReturn(Optional.of(usuario(5, "ana@x.com", "{bcrypt}abc")));

		UserDetails d = service.loadUserByUsername("  ana@x.com ");

		assertThat(d).isInstanceOf(UsuarioAutenticado.class);
		assertThat(((UsuarioAutenticado) d).getId()).isEqualTo(5L);
		assertThat(d.getPassword()).isEqualTo("{bcrypt}abc");
	}

	@Test
	void loadUserConEmailInexistenteLanzaUsernameNotFound() {
		when(repository.findByEmailIgnoreCase("nadie@x.com")).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.loadUserByUsername("nadie@x.com")).isInstanceOf(UsernameNotFoundException.class);
	}

	@Test
	void unUsuarioSinContrasenaNoPuedeEntrar() {
		when(repository.findByEmailIgnoreCase("yo@agoals.local"))
				.thenReturn(Optional.of(usuario(1, "yo@agoals.local", "sin-login-v1")));

		assertThatThrownBy(() -> service.loadUserByUsername("yo@agoals.local")).isInstanceOf(UsernameNotFoundException.class);
	}

	@Test
	void buscarDevuelveElUsuarioSinHash() {
		when(repository.findById(5L)).thenReturn(Optional.of(usuario(5, "ana@x.com", "{bcrypt}abc")));

		var r = service.buscar(5L);

		assertThat(r.id()).isEqualTo(5L);
		assertThat(r.email()).isEqualTo("ana@x.com");
		assertThat(r.nombreUsuario()).isEqualTo("yo");
	}

	// ---------------------------------------------------------------- clave inicial

	@Test
	void fijaElHashSoloSiTodaviaEsSinLoginV1() {
		Usuario u = usuario(1, "yo@agoals.local", "sin-login-v1");
		when(repository.findById(1L)).thenReturn(Optional.of(u));
		when(encoder.encode("secreta")).thenReturn("{bcrypt}HASH");

		var r = service.fijarCredencialesIniciales(Optional.of("secreta"), Optional.empty());

		assertThat(r).isEqualTo(ResultadoClaveInicial.FIJADA);
		assertThat(u.getContrasenaHash()).isEqualTo("{bcrypt}HASH");
		assertThat(u.getEmail()).isEqualTo("yo@agoals.local");
		verify(repository).save(u);
	}

	@Test
	void nuncaPisaUnHashReal() {
		Usuario u = usuario(1, "yo@agoals.local", "{bcrypt}REAL");
		when(repository.findById(1L)).thenReturn(Optional.of(u));

		var r = service.fijarCredencialesIniciales(Optional.of("otra"), Optional.of("otro@x.com"));

		assertThat(r).isEqualTo(ResultadoClaveInicial.YA_TENIA_CLAVE);
		assertThat(u.getContrasenaHash()).isEqualTo("{bcrypt}REAL");
		assertThat(u.getEmail()).isEqualTo("yo@agoals.local");
		verify(repository, never()).save(any());
		verifyNoInteractions(encoder);
	}

	@Test
	void sinVariableYSinContrasenaDevuelveSinVariableYNoToca() {
		Usuario u = usuario(1, "yo@agoals.local", "sin-login-v1");
		when(repository.findById(1L)).thenReturn(Optional.of(u));

		assertThat(service.fijarCredencialesIniciales(Optional.empty(), Optional.of("a@x.com")))
				.isEqualTo(ResultadoClaveInicial.SIN_VARIABLE);
		assertThat(service.fijarCredencialesIniciales(Optional.of("   "), Optional.empty()))
				.isEqualTo(ResultadoClaveInicial.SIN_VARIABLE);

		assertThat(u.getContrasenaHash()).isEqualTo("sin-login-v1");
		verify(repository, never()).save(any());
		verifyNoInteractions(encoder);
	}

	@Test
	void conContrasenaRealYSinVariableDevuelveYaTeniaClaveYNoAvisa() {
		Usuario u = usuario(1, "yo@agoals.local", "{bcrypt}REAL");
		when(repository.findById(1L)).thenReturn(Optional.of(u));

		assertThat(service.fijarCredencialesIniciales(Optional.empty(), Optional.empty()))
				.isEqualTo(ResultadoClaveInicial.YA_TENIA_CLAVE);
		assertThat(service.fijarCredencialesIniciales(Optional.of("   "), Optional.of("a@x.com")))
				.isEqualTo(ResultadoClaveInicial.YA_TENIA_CLAVE);

		assertThat(u.getContrasenaHash()).isEqualTo("{bcrypt}REAL");
		verify(repository, never()).save(any());
		verifyNoInteractions(encoder);
	}

	@Test
	void sinUsuarioUnoNoFalla() {
		when(repository.findById(1L)).thenReturn(Optional.empty());

		assertThat(service.fijarCredencialesIniciales(Optional.of("x"), Optional.empty()))
				.isEqualTo(ResultadoClaveInicial.SIN_USUARIO);
		assertThat(service.fijarCredencialesIniciales(Optional.empty(), Optional.empty()))
				.isEqualTo(ResultadoClaveInicial.SIN_USUARIO);
	}

	@Test
	void guardaElEmailInicialRecortadoYEnMinusculas() {
		Usuario u = usuario(1, "yo@agoals.local", "sin-login-v1");
		when(repository.findById(1L)).thenReturn(Optional.of(u));
		when(repository.findByEmailIgnoreCase("felipe@correo.com")).thenReturn(Optional.empty());
		when(encoder.encode("secreta")).thenReturn("{bcrypt}HASH");

		var r = service.fijarCredencialesIniciales(Optional.of("secreta"), Optional.of("  Felipe@Correo.COM "));

		assertThat(r).isEqualTo(ResultadoClaveInicial.FIJADA);
		assertThat(u.getEmail()).isEqualTo("felipe@correo.com");
	}

	@Test
	void siElEmailYaLoTieneOtroUsuarioLoDejaComoEstaba() {
		Usuario u = usuario(1, "yo@agoals.local", "sin-login-v1");
		when(repository.findById(1L)).thenReturn(Optional.of(u));
		when(repository.findByEmailIgnoreCase("otro@x.com")).thenReturn(Optional.of(usuario(9, "otro@x.com", "{bcrypt}z")));
		when(encoder.encode("secreta")).thenReturn("{bcrypt}HASH");

		var r = service.fijarCredencialesIniciales(Optional.of("secreta"), Optional.of("otro@x.com"));

		assertThat(r).isEqualTo(ResultadoClaveInicial.FIJADA_EMAIL_OCUPADO);
		assertThat(u.getEmail()).isEqualTo("yo@agoals.local");
		assertThat(u.getContrasenaHash()).isEqualTo("{bcrypt}HASH");
	}
}
