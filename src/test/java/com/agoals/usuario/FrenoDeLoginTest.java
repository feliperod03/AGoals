package com.agoals.usuario;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FrenoDeLoginTest {

	private static final String IP = "198.51.100.1";
	private static final String EMAIL = "ana@x.com";

	private RelojMovible reloj;
	private FrenoDeLogin freno;

	@BeforeEach
	void preparar() {
		reloj = new RelojMovible(Instant.parse("2026-11-17T12:00:00Z"));
		// 5 por par, 20 por IP, ventana y bloqueo de 15 min, 1000 entradas.
		freno = nuevo(1000);
	}

	private FrenoDeLogin nuevo(int maxEntradas) {
		return new FrenoDeLogin(reloj, 5, 20, Duration.ofMinutes(15), Duration.ofMinutes(15), maxEntradas);
	}

	private void fallar(String ip, String email, int veces) {
		for (int i = 0; i < veces; i++) {
			freno.comprobar(ip, email);
			freno.registrarFallo(ip, email);
		}
	}

	@Test
	void elQuintoFalloDelParBloqueaYElSextoIntentoDa429() {
		fallar(IP, EMAIL, 4);
		assertThatCode(() -> freno.comprobar(IP, EMAIL)).doesNotThrowAnyException();

		freno.registrarFallo(IP, EMAIL);

		assertThatThrownBy(() -> freno.comprobar(IP, EMAIL)).isInstanceOf(LoginBloqueadoException.class)
				.satisfies(e -> assertThat(((LoginBloqueadoException) e).getSegundos()).isEqualTo(15 * 60));
	}

	@Test
	void seDesbloqueaAlTerminarElBloqueo() {
		fallar(IP, EMAIL, 5);
		assertThatThrownBy(() -> freno.comprobar(IP, EMAIL)).isInstanceOf(LoginBloqueadoException.class);

		reloj.avanzar(Duration.ofMinutes(14).plusSeconds(59));
		assertThatThrownBy(() -> freno.comprobar(IP, EMAIL)).isInstanceOf(LoginBloqueadoException.class);

		reloj.avanzar(Duration.ofSeconds(1));
		assertThatCode(() -> freno.comprobar(IP, EMAIL)).doesNotThrowAnyException();
		// Y empieza de cero: hacen falta otros 5 fallos.
		fallar(IP, EMAIL, 4);
		assertThatCode(() -> freno.comprobar(IP, EMAIL)).doesNotThrowAnyException();
	}

	@Test
	void losFallosFueraDeLaVentanaNoSuman() {
		fallar(IP, EMAIL, 4);
		reloj.avanzar(Duration.ofMinutes(15));

		fallar(IP, EMAIL, 4);

		assertThatCode(() -> freno.comprobar(IP, EMAIL)).doesNotThrowAnyException();
	}

	@Test
	void unLoginCorrectoReiniciaElParPeroNoLaIp() {
		fallar(IP, EMAIL, 4);
		freno.registrarExito(IP, EMAIL);
		fallar(IP, EMAIL, 4);
		assertThatCode(() -> freno.comprobar(IP, EMAIL)).doesNotThrowAnyException();

		// La IP acumuló 8 fallos y no se reinició: con 12 más en otros emails (20 en total) se bloquea.
		for (int i = 0; i < 12; i++) {
			freno.registrarFallo(IP, "otro" + i + "@x.com");
		}
		assertThatThrownBy(() -> freno.comprobar(IP, "nuevo@x.com")).isInstanceOf(LoginBloqueadoException.class);
	}

	@Test
	void veinteFallosDeUnaIpConEmailsDistintosLaBloquean() {
		for (int i = 0; i < 19; i++) {
			freno.registrarFallo(IP, "e" + i + "@x.com");
		}
		assertThatCode(() -> freno.comprobar(IP, "otro@x.com")).doesNotThrowAnyException();

		freno.registrarFallo(IP, "e19@x.com");

		assertThatThrownBy(() -> freno.comprobar(IP, "otro@x.com")).isInstanceOf(LoginBloqueadoException.class);
	}

	@Test
	void otroParNoQuedaBloqueado() {
		fallar(IP, EMAIL, 5);

		// El mismo email desde otra IP y otro email desde la misma IP siguen pudiendo entrar.
		assertThatCode(() -> freno.comprobar("203.0.113.9", EMAIL)).doesNotThrowAnyException();
		assertThatCode(() -> freno.comprobar(IP, "bea@x.com")).doesNotThrowAnyException();
	}

	@Test
	void elEmailSeNormaliza() {
		fallar(IP, "Ana@X.com", 3);
		fallar(IP, "  ana@x.COM ", 2);

		assertThatThrownBy(() -> freno.comprobar(IP, "ana@x.com")).isInstanceOf(LoginBloqueadoException.class);
	}

	@Test
	void elMapaNoPasaDelMaximoYLimpiaLosVencidos() {
		freno = nuevo(3);
		for (int i = 0; i < 10; i++) {
			freno.registrarFallo("198.51.100." + i, "e" + i + "@x.com");
		}
		assertThat(freno.entradasPares()).isEqualTo(3);
		assertThat(freno.entradasIps()).isEqualTo(3);

		reloj.avanzar(Duration.ofMinutes(16));
		freno.comprobar(IP, EMAIL); // la limpieza corre al comprobar

		assertThat(freno.entradasPares()).isZero();
		assertThat(freno.entradasIps()).isZero();
	}

	@Test
	void laEsperaSeRedondeaHaciaArribaAMinutosYComoMinimoUno() {
		assertThat(new LoginBloqueadoException(1).getMessage()).contains("Espera 1 minuto y");
		assertThat(new LoginBloqueadoException(60).getMessage()).contains("Espera 1 minuto y");
		assertThat(new LoginBloqueadoException(61).getMessage()).contains("Espera 2 minutos y");
		assertThat(new LoginBloqueadoException(15 * 60).getMessage()).contains("Espera 15 minutos y");
	}
}
