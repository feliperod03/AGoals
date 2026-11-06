package com.agoals.tarea;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Usa el PostgreSQL real de Docker (con Flyway aplicado) para validar el mapeo contra el esquema.
// Cada test hace rollback al terminar.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TareaRepositoryTest {

	@Autowired
	TareaRepository repository;

	private Tarea nueva(String titulo) {
		Tarea t = new Tarea();
		t.setUsuarioId(1L);
		t.setTitulo(titulo);
		return t;
	}

	@Test
	void guardaYLeeConDefaultsDeLaBase() {
		Tarea t = nueva("probar");
		t.setPrioridad(Prioridad.MEDIA);
		t.setFecha(LocalDate.of(2026, 11, 5));
		t.setHoraInicio(LocalTime.of(9, 0));
		t.setHoraFin(LocalTime.of(10, 0));
		repository.saveAndFlush(t);

		assertThat(t.getFechaCreacion()).isNotNull();
		Tarea leida = repository.findByIdAndUsuarioId(t.getId(), 1L).orElseThrow();
		assertThat(leida.getEstado()).isEqualTo(Estado.PENDIENTE);
		assertThat(leida.getPrioridad()).isEqualTo(Prioridad.MEDIA);
		assertThat(leida.getHoraFin()).isEqualTo(LocalTime.of(10, 0));
		assertThat(leida.getVecesPospuesta()).isZero();
	}

	@Test
	void buscaPorFechaYUsuarioOrdenadoPorHora() {
		LocalDate dia = LocalDate.of(2026, 11, 6);
		Tarea tarde = nueva("tarde");
		tarde.setFecha(dia);
		tarde.setHoraInicio(LocalTime.of(15, 0));
		Tarea temprano = nueva("temprano");
		temprano.setFecha(dia);
		temprano.setHoraInicio(LocalTime.of(8, 0));
		Tarea suelta = nueva("suelta");
		suelta.setFecha(dia);
		Tarea otroDia = nueva("otro día");
		otroDia.setFecha(dia.plusDays(1));
		repository.saveAllAndFlush(java.util.List.of(tarde, temprano, suelta, otroDia));

		assertThat(repository.findByUsuarioIdAndFechaOrderByHoraInicioAscIdAsc(1L, dia))
				.extracting(Tarea::getTitulo)
				.containsExactly("temprano", "tarde", "suelta");
		assertThat(repository.findByUsuarioIdAndFechaOrderByHoraInicioAscIdAsc(2L, dia)).isEmpty();
	}

	@Test
	void laBaseRechazaHoraSinFecha() {
		Tarea t = nueva("invalida");
		t.setHoraInicio(LocalTime.of(9, 0));

		assertThatThrownBy(() -> repository.saveAndFlush(t)).isInstanceOf(Exception.class);
	}
}
