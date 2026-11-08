package com.agoals.evento;

import com.agoals.common.Prioridad;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Usa el PostgreSQL real de Docker (con Flyway aplicado) para validar el mapeo, el orden y el CHECK de la base.
// El filtro por rango NO está aquí: se hace en EventoService (ver el comentario de EventoRepository) y sus bordes
// se prueban en EventoServiceTest. Cada test hace rollback al terminar. La base de desarrollo puede tener eventos
// reales del usuario 1: los de prueba van en 2090 y se comprueban por ids propios, nunca por tamaño de lista.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class EventoRepositoryTest {

	@Autowired
	EventoRepository repository;

	@Autowired
	EntityManager em;

	private static OffsetDateTime t(String iso) {
		return OffsetDateTime.parse(iso);
	}

	private Evento guardar(String titulo, String inicio, String fin) {
		Evento e = new Evento();
		e.setUsuarioId(1L);
		e.setTitulo(titulo);
		e.setFechaHoraInicio(t(inicio));
		e.setFechaHoraFin(t(fin));
		return repository.saveAndFlush(e);
	}

	@Test
	void guardaYLeeConDefaultsDeLaBase() {
		Evento e = guardar("Dentista", "2090-03-01T15:00:00-03:00", "2090-03-01T16:00:00-03:00");
		em.clear();

		Evento leido = repository.findByIdAndUsuarioId(e.getId(), 1L).orElseThrow();
		assertThat(leido.getTitulo()).isEqualTo("Dentista");
		assertThat(leido.getDescripcion()).isEmpty();
		assertThat(leido.getPrioridad()).isNull();
		// Se comparan instantes: el desfase de lo leído depende de la zona de la JVM.
		assertThat(leido.getFechaHoraInicio().toInstant()).isEqualTo(t("2090-03-01T18:00:00Z").toInstant());
		assertThat(leido.getFechaHoraFin().toInstant()).isEqualTo(t("2090-03-01T19:00:00Z").toInstant());
	}

	@Test
	void guardaLaPrioridad() {
		Evento e = new Evento();
		e.setUsuarioId(1L);
		e.setTitulo("Importante");
		e.setFechaHoraInicio(t("2090-03-01T10:00:00-03:00"));
		e.setFechaHoraFin(t("2090-03-01T11:00:00-03:00"));
		e.setPrioridad(Prioridad.ALTA);
		repository.saveAndFlush(e);
		em.clear();

		assertThat(repository.findByIdAndUsuarioId(e.getId(), 1L).orElseThrow().getPrioridad())
				.isEqualTo(Prioridad.ALTA);
	}

	@Test
	void noEncuentraEventosDeOtroUsuario() {
		Evento e = guardar("mio", "2090-03-01T10:00:00-03:00", "2090-03-01T11:00:00-03:00");

		assertThat(repository.findByIdAndUsuarioId(e.getId(), 2L)).isEmpty();
		assertThat(repository.findByUsuarioIdOrderByFechaHoraInicioAscIdAsc(2L)).isEmpty();
		assertThat(repository.findByUsuarioIdOrderByFechaHoraInicioAscIdAsc(1L)).contains(e);
	}

	@Test
	void ordenaPorInicioAscendenteYLuegoPorId() {
		Evento tarde = guardar("tarde", "2090-06-01T15:00:00-03:00", "2090-06-01T16:00:00-03:00");
		Evento mismaHora1 = guardar("misma-1", "2090-06-01T09:00:00-03:00", "2090-06-01T10:00:00-03:00");
		Evento mismaHora2 = guardar("misma-2", "2090-06-01T09:00:00-03:00", "2090-06-01T12:00:00-03:00");
		Evento temprano = guardar("temprano", "2090-06-01T08:00:00-03:00", "2090-06-01T08:30:00-03:00");
		Set<Long> mios = Set.of(tarde.getId(), mismaHora1.getId(), mismaHora2.getId(), temprano.getId());

		List<Long> propios = repository.findByUsuarioIdOrderByFechaHoraInicioAscIdAsc(1L).stream()
				.map(Evento::getId).filter(mios::contains).toList();

		assertThat(propios).containsExactly(temprano.getId(), mismaHora1.getId(), mismaHora2.getId(), tarde.getId());
		assertThat(mismaHora2.getId()).isGreaterThan(mismaHora1.getId());
	}

	@Test
	void laBaseRechazaUnFinIgualAlInicio() {
		assertThatThrownBy(() -> guardar("igual", "2090-07-01T10:00:00-03:00", "2090-07-01T10:00:00-03:00"))
				.isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaUnFinAnteriorAlInicio() {
		assertThatThrownBy(() -> guardar("invertido", "2090-07-01T11:00:00-03:00", "2090-07-01T10:00:00-03:00"))
				.isInstanceOf(Exception.class);
	}
}
