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
	void laBaseRechazaHoraSinFecha() {
		Tarea t = nueva("invalida");
		t.setHoraInicio(LocalTime.of(9, 0));

		assertThatThrownBy(() -> repository.saveAndFlush(t)).isInstanceOf(Exception.class);
	}
}
