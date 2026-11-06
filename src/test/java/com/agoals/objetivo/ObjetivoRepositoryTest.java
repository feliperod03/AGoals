package com.agoals.objetivo;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Usa el PostgreSQL real de Docker (con Flyway aplicado) para validar el mapeo contra el esquema.
// Cada test hace rollback al terminar. La base puede tener datos del usuario: por eso los filtros usan
// contains / doesNotContain.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ObjetivoRepositoryTest {

	@Autowired
	ObjetivoRepository repository;

	private Objetivo nuevo(String nombre) {
		Objetivo o = new Objetivo();
		o.setUsuarioId(1L);
		o.setNombre(nombre);
		return o;
	}

	@Test
	void guardaYLeeConDefaultsDeLaBase() {
		Objetivo o = nuevo("Inglés");
		o.setPrioridad(Prioridad.MEDIA);
		repository.saveAndFlush(o);

		assertThat(o.getFechaCreacion()).isNotNull();
		Objetivo leido = repository.findByIdAndUsuarioId(o.getId(), 1L).orElseThrow();
		assertThat(leido.getEstado()).isEqualTo(Estado.PENDIENTE);
		assertThat(leido.getDescripcion()).isEmpty();
		assertThat(leido.getPrioridad()).isEqualTo(Prioridad.MEDIA);
		assertThat(leido.getPadreId()).isNull();
	}

	@Test
	void noEncuentraObjetivosDeOtroUsuario() {
		Objetivo o = repository.saveAndFlush(nuevo("Inglés"));

		assertThat(repository.findByIdAndUsuarioId(o.getId(), 2L)).isEmpty();
		assertThat(repository.existsByIdAndUsuarioId(o.getId(), 1L)).isTrue();
		assertThat(repository.existsByIdAndUsuarioId(o.getId(), 2L)).isFalse();
		assertThat(repository.existsByIdAndUsuarioId(999_999L, 1L)).isFalse();
	}

	@Test
	void existsByPadreIdDetectaSubobjetivos() {
		Objetivo padre = repository.saveAndFlush(nuevo("padre"));
		Objetivo solo = repository.saveAndFlush(nuevo("solo"));
		Objetivo hijo = nuevo("hijo");
		hijo.setPadreId(padre.getId());
		repository.saveAndFlush(hijo);

		assertThat(repository.existsByPadreIdAndUsuarioId(padre.getId(), 1L)).isTrue();
		assertThat(repository.existsByPadreIdAndUsuarioId(solo.getId(), 1L)).isFalse();
		assertThat(repository.existsByPadreIdAndUsuarioId(padre.getId(), 2L)).isFalse();
	}

	@Test
	void filtraPorEstadoYSinFiltroDevuelveTodos() {
		Objetivo a = nuevo("a-pendiente");
		Objetivo b = nuevo("b-en-progreso");
		b.setEstado(Estado.EN_PROGRESO);
		Objetivo c = nuevo("c-hecho");
		c.setEstado(Estado.HECHO);
		repository.saveAllAndFlush(List.of(a, b, c));

		assertThat(repository.listar(1L, Estado.EN_PROGRESO)).extracting(Objetivo::getNombre)
				.contains("b-en-progreso").doesNotContain("a-pendiente", "c-hecho");
		assertThat(repository.listar(1L, null)).extracting(Objetivo::getNombre)
				.contains("a-pendiente", "b-en-progreso", "c-hecho");
		assertThat(repository.listar(2L, null)).isEmpty();
	}

	@Test
	void laBaseRechazaUnPadreInexistente() {
		Objetivo o = nuevo("huérfano");
		o.setPadreId(999_999L);

		assertThatThrownBy(() -> repository.saveAndFlush(o)).isInstanceOf(Exception.class);
	}
}
