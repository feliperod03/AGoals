package com.agoals.proyecto;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Usa el PostgreSQL real de Docker (con Flyway aplicado) para validar el mapeo contra el esquema.
// Cada test hace rollback al terminar. La base puede tener datos del usuario: los tests de filtros
// se aíslan con un objetivo propio y, donde no se puede, usan contains / doesNotContain.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ProyectoRepositoryTest {

	@Autowired
	ProyectoRepository repository;

	@Autowired
	EntityManager em;

	private Proyecto nuevo(String nombre) {
		Proyecto p = new Proyecto();
		p.setUsuarioId(1L);
		p.setNombre(nombre);
		return p;
	}

	// El módulo objetivo llega en la 4b: se inserta la fila con SQL nativo.
	private Long objetivo() {
		return ((Number) em.createNativeQuery(
				"INSERT INTO objetivo (usuario_id, nombre) VALUES (1, 'o') RETURNING id").getSingleResult())
				.longValue();
	}

	@Test
	void guardaYLeeConDefaultsDeLaBase() {
		Proyecto p = nuevo("Casa");
		p.setPrioridad(Prioridad.MEDIA);
		repository.saveAndFlush(p);

		assertThat(p.getFechaCreacion()).isNotNull();
		Proyecto leido = repository.findByIdAndUsuarioId(p.getId(), 1L).orElseThrow();
		assertThat(leido.getEstado()).isEqualTo(Estado.PENDIENTE);
		assertThat(leido.getDescripcion()).isEmpty();
		assertThat(leido.getPrioridad()).isEqualTo(Prioridad.MEDIA);
		assertThat(leido.getPadreId()).isNull();
		assertThat(leido.getObjetivoId()).isNull();
	}

	@Test
	void noEncuentraProyectosDeOtroUsuario() {
		Proyecto p = nuevo("Casa");
		repository.saveAndFlush(p);

		assertThat(repository.findByIdAndUsuarioId(p.getId(), 2L)).isEmpty();
	}

	@Test
	void existsByPadreIdDetectaSubproyectos() {
		Proyecto padre = repository.saveAndFlush(nuevo("padre"));
		Proyecto solo = repository.saveAndFlush(nuevo("solo"));
		Proyecto hijo = nuevo("hijo");
		hijo.setPadreId(padre.getId());
		repository.saveAndFlush(hijo);

		assertThat(repository.existsByPadreIdAndUsuarioId(padre.getId(), 1L)).isTrue();
		assertThat(repository.existsByPadreIdAndUsuarioId(solo.getId(), 1L)).isFalse();
		assertThat(repository.existsByPadreIdAndUsuarioId(padre.getId(), 2L)).isFalse();
	}

	@Test
	void findByPadreIdDevuelveLosSubproyectosDirectos() {
		Proyecto padre = repository.saveAndFlush(nuevo("padre"));
		Proyecto hijo = nuevo("hijo");
		hijo.setPadreId(padre.getId());
		repository.saveAndFlush(hijo);
		Proyecto nieto = nuevo("nieto");
		nieto.setPadreId(hijo.getId());
		repository.saveAndFlush(nieto);

		assertThat(repository.findByPadreIdAndUsuarioId(padre.getId(), 1L)).extracting(Proyecto::getNombre)
				.containsExactly("hijo");
		assertThat(repository.findByPadreIdAndUsuarioId(padre.getId(), 2L)).isEmpty();
	}

	@Test
	void findByObjetivoIdInDevuelveLosProyectosLigadosDirectamente() {
		Long obj = objetivo();
		Long otroObj = objetivo();
		Proyecto p = nuevo("del objetivo");
		p.setObjetivoId(obj);
		Proyecto q = nuevo("del otro");
		q.setObjetivoId(otroObj);
		repository.saveAllAndFlush(java.util.List.of(p, q, nuevo("sin objetivo")));

		assertThat(repository.findByUsuarioIdAndObjetivoIdIn(1L, java.util.List.of(obj))).extracting(Proyecto::getNombre)
				.containsExactly("del objetivo");
		assertThat(repository.findByUsuarioIdAndObjetivoIdIn(1L, java.util.List.of(obj, otroObj)))
				.extracting(Proyecto::getNombre).containsExactlyInAnyOrder("del objetivo", "del otro");
		assertThat(repository.findByUsuarioIdAndObjetivoIdIn(2L, java.util.List.of(obj))).isEmpty();
	}

	@Test
	void filtraPorEstadoYObjetivoEnLasCuatroCombinaciones() {
		Long obj = objetivo();
		Long otroObj = objetivo();
		Proyecto a = nuevo("a-pendiente");
		a.setObjetivoId(obj);
		Proyecto b = nuevo("b-en-progreso");
		b.setObjetivoId(obj);
		b.setEstado(Estado.EN_PROGRESO);
		Proyecto c = nuevo("c-otro-objetivo");
		c.setObjetivoId(otroObj);
		c.setEstado(Estado.EN_PROGRESO);
		Proyecto d = nuevo("d-sin-objetivo");
		d.setEstado(Estado.HECHO);
		repository.saveAllAndFlush(java.util.List.of(a, b, c, d));
		em.clear();

		// estado = null, objetivoId = X
		assertThat(repository.listar(1L, null, obj)).extracting(Proyecto::getNombre)
				.containsExactly("a-pendiente", "b-en-progreso");
		// estado = X, objetivoId = X
		assertThat(repository.listar(1L, Estado.EN_PROGRESO, obj)).extracting(Proyecto::getNombre)
				.containsExactly("b-en-progreso");
		// estado = X, objetivoId = null
		assertThat(repository.listar(1L, Estado.HECHO, null)).extracting(Proyecto::getNombre)
				.contains("d-sin-objetivo").doesNotContain("a-pendiente", "b-en-progreso", "c-otro-objetivo");
		// estado = null, objetivoId = null
		assertThat(repository.listar(1L, null, null)).extracting(Proyecto::getNombre)
				.contains("a-pendiente", "b-en-progreso", "c-otro-objetivo", "d-sin-objetivo");
	}

	@Test
	void filtroSinCoincidenciasDevuelveListaVacia() {
		Long obj = objetivo();

		assertThat(repository.listar(1L, null, obj)).isEmpty();
		assertThat(repository.listar(2L, null, null)).isEmpty();
	}

	@Test
	void laBaseRechazaUnObjetivoInexistente() {
		Proyecto p = nuevo("huérfano");
		p.setObjetivoId(999_999L);

		assertThatThrownBy(() -> repository.saveAndFlush(p)).isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaUnPadreInexistente() {
		Proyecto p = nuevo("huérfano");
		p.setPadreId(999_999L);

		assertThatThrownBy(() -> repository.saveAndFlush(p)).isInstanceOf(Exception.class);
	}
}
