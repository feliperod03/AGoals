package com.agoals.common;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Test unitario puro (sin Spring ni Mockito): el árbol se simula con un mapa id -> padreId.
class JerarquiaTest {

	static class Falla extends RuntimeException {
		Falla(String mensaje) {
			super(mensaje);
		}
	}

	// Árbol de prueba: 1 -> 2 -> 3 (3 es nieto de 1), y 4 -> 5 en otra rama. 6 es un ciclo corrupto: 6 <-> 7.
	private final Map<Long, Long> padres = new HashMap<>();

	JerarquiaTest() {
		padres.put(1L, null);
		padres.put(2L, 1L);
		padres.put(3L, 2L);
		padres.put(4L, null);
		padres.put(5L, 4L);
		padres.put(6L, 7L);
		padres.put(7L, 6L);
	}

	private void validar(Long padreId, Long idActual) {
		Jerarquia.validarPadre("proyecto", padreId, idActual,
				id -> padres.containsKey(id) ? Optional.of(id) : Optional.empty(),
				padres::get, Falla::new);
	}

	@Test
	void sinPadreEsSiempreValido() {
		assertThatCode(() -> validar(null, 1L)).doesNotThrowAnyException();
		assertThatCode(() -> validar(null, null)).doesNotThrowAnyException();
	}

	@Test
	void unRegistroNoPuedeSerSuPropioPadre() {
		assertThatThrownBy(() -> validar(1L, 1L)).isInstanceOf(Falla.class)
				.hasMessage("Un proyecto no puede ser su propio padre");
	}

	@Test
	void padreInexistenteFalla() {
		assertThatThrownBy(() -> validar(99L, null)).isInstanceOf(Falla.class)
				.hasMessage("El proyecto padre no existe: 99");
		assertThatThrownBy(() -> validar(99L, 1L)).isInstanceOf(Falla.class)
				.hasMessageContaining("padre no existe");
	}

	@Test
	void ponerUnRegistroBajoSuHijoDirectoEsCiclo() {
		assertThatThrownBy(() -> validar(2L, 1L)).isInstanceOf(Falla.class)
				.hasMessageContaining("Ciclo");
	}

	@Test
	void ponerUnRegistroBajoUnDescendienteIndirectoEsCiclo() {
		assertThatThrownBy(() -> validar(3L, 1L)).isInstanceOf(Falla.class)
				.hasMessage("Ciclo en la jerarquía: el proyecto 3 es descendiente del proyecto 1");
	}

	@Test
	void moverAOtraRamaOSubirDeNivelEsValido() {
		assertThatCode(() -> validar(5L, 2L)).doesNotThrowAnyException();
		assertThatCode(() -> validar(1L, 3L)).doesNotThrowAnyException();
	}

	@Test
	void crearBajoCualquierPadreExistenteEsValido() {
		assertThatCode(() -> validar(3L, null)).doesNotThrowAnyException();
	}

	private void validarFemenino(Long padreId, Long idActual) {
		Jerarquia.validarPadre("tarea", true, padreId, idActual,
				id -> padres.containsKey(id) ? Optional.of(id) : Optional.empty(),
				padres::get, Falla::new);
	}

	@Test
	void conEntidadFemeninaLosMensajesUsanLosArticulosCorrectos() {
		assertThatThrownBy(() -> validarFemenino(1L, 1L))
				.hasMessage("Una tarea no puede ser su propio padre");
		assertThatThrownBy(() -> validarFemenino(99L, null))
				.hasMessage("La tarea padre no existe: 99");
		assertThatThrownBy(() -> validarFemenino(3L, 1L))
				.hasMessage("Ciclo en la jerarquía: la tarea 3 es descendiente de la tarea 1");
	}

	@Test
	void conEntidadFemeninaLasReglasSonLasMismas() {
		assertThatCode(() -> validarFemenino(null, 1L)).doesNotThrowAnyException();
		assertThatCode(() -> validarFemenino(5L, 2L)).doesNotThrowAnyException();
		assertThatThrownBy(() -> validarFemenino(2L, 1L)).hasMessageContaining("Ciclo");
	}

	@Test
	void unCicloYaExistenteEnLosDatosNoCuelgaElRecorrido() {
		// 6 <-> 7 ya es un ciclo en la base; el Set de visitados corta el bucle.
		assertThatCode(() -> validar(6L, 1L)).doesNotThrowAnyException();
	}

	// ---- hojasPrimero ----

	private List<Long> hijasDe(Long id) {
		return padres.entrySet().stream()
				.filter(e -> id.equals(e.getValue()))
				.map(Map.Entry::getKey)
				.sorted()
				.toList();
	}

	private List<Long> hojasPrimero(List<Long> raices, Predicate<Long> corta) {
		return Jerarquia.hojasPrimero(raices, id -> id, this::hijasDe, corta);
	}

	@Test
	void hojasPrimeroPoneCadaHijoAntesQueSuPadre() {
		assertThat(hojasPrimero(List.of(1L), id -> false)).containsExactly(3L, 2L, 1L);
	}

	@Test
	void hojasPrimeroConUnaHojaDevuelveSoloEsaHoja() {
		assertThat(hojasPrimero(List.of(3L), id -> false)).containsExactly(3L);
	}

	@Test
	void hojasPrimeroConVariasRaicesDevuelveCadaArbolSinMezclarElOrdenInterno() {
		assertThat(hojasPrimero(List.of(1L, 4L), id -> false)).containsExactly(3L, 2L, 1L, 5L, 4L);
	}

	@Test
	void hojasPrimeroConRaicesAnidadasNoDuplicaYBorraLaHijaAntesQueLaMadre() {
		// 2 es hija de 1 y también viene como raíz, en cualquiera de los dos órdenes.
		assertThat(hojasPrimero(List.of(1L, 2L), id -> false)).containsExactly(3L, 2L, 1L);
		assertThat(hojasPrimero(List.of(2L, 1L), id -> false)).containsExactly(3L, 2L, 1L);
	}

	@Test
	void hojasPrimeroConCortaNoIncluyeNiBajaPorEseHijo() {
		// Se corta en 2: ni 2 ni su hija 3 entran. La raíz 1 siempre entra.
		assertThat(hojasPrimero(List.of(1L), id -> id == 2L)).containsExactly(1L);
	}

	@Test
	void hojasPrimeroNoAplicaCortaALasRaices() {
		assertThat(hojasPrimero(List.of(2L), id -> id == 2L)).containsExactly(3L, 2L);
	}

	@Test
	void hojasPrimeroConUnCicloNoCuelgaYNoRepite() {
		// 6 <-> 7 es un ciclo corrupto: cada uno sale una sola vez.
		assertThat(hojasPrimero(List.of(6L), id -> false)).containsExactly(7L, 6L);
	}
}
