package com.agoals.idea;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Usa el PostgreSQL real de Docker (con Flyway aplicado) para validar el mapeo y la consulta con filtros
// opcionales (incluye los parámetros null, que en Postgres pueden dar error de tipo si la consulta está mal).
// Cada test hace rollback al terminar. La base puede tener datos del usuario: los filtros se aíslan con un
// proyecto y un objetivo propios y, donde no se puede, se usa contains / doesNotContain.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class IdeaRepositoryTest {

	@Autowired
	IdeaRepository repository;

	@Autowired
	EntityManager em;

	private Idea nueva(String titulo) {
		Idea i = new Idea();
		i.setUsuarioId(1L);
		i.setTitulo(titulo);
		return i;
	}

	private Idea guardar(String titulo, Long proyectoId, Long objetivoId) {
		Idea i = nueva(titulo);
		i.setProyectoId(proyectoId);
		i.setObjetivoId(objetivoId);
		return repository.saveAndFlush(i);
	}

	// Los repositories de proyecto/objetivo no se usan aquí (módulo idea no depende de ellos): SQL nativo.
	private Long fila(String tabla) {
		return ((Number) em.createNativeQuery(
				"INSERT INTO " + tabla + " (usuario_id, nombre) VALUES (1, 'x') RETURNING id").getSingleResult())
				.longValue();
	}

	private static List<String> titulos(List<Idea> ideas) {
		return ideas.stream().map(Idea::getTitulo).toList();
	}

	@Test
	void guardaYLeeConDefaultsDeLaBase() {
		Idea i = guardar("Idea suelta", null, null);

		assertThat(i.getFechaCreacion()).isNotNull();
		Idea leida = repository.findByIdAndUsuarioId(i.getId(), 1L).orElseThrow();
		assertThat(leida.getEstado()).isEqualTo(EstadoIdea.PLANTEADA);
		assertThat(leida.getDescripcion()).isEmpty();
		assertThat(leida.getConclusion()).isNull();
		assertThat(leida.getFechaCierre()).isNull();
		assertThat(leida.getProyectoId()).isNull();
		assertThat(leida.getObjetivoId()).isNull();
	}

	@Test
	void guardaConclusionYFechaDeCierre() {
		Idea i = nueva("Cerrada");
		i.setEstado(EstadoIdea.CONCLUIDA);
		i.setConclusion("Se descarta");
		OffsetDateTime cierre = OffsetDateTime.now();
		i.setFechaCierre(cierre);
		repository.saveAndFlush(i);
		em.clear();

		Idea leida = repository.findByIdAndUsuarioId(i.getId(), 1L).orElseThrow();
		assertThat(leida.getEstado()).isEqualTo(EstadoIdea.CONCLUIDA);
		assertThat(leida.getConclusion()).isEqualTo("Se descarta");
		assertThat(leida.getFechaCierre()).isNotNull();
	}

	@Test
	void noEncuentraIdeasDeOtroUsuario() {
		Idea i = guardar("mia", null, null);

		assertThat(repository.findByIdAndUsuarioId(i.getId(), 2L)).isEmpty();
		assertThat(repository.listar(2L, null, null, null, false)).isEmpty();
	}

	@Test
	void buscaPorColeccionesDeProyectosYObjetivosRespetandoAlUsuario() {
		Long proyecto1 = fila("proyecto");
		Long proyecto2 = fila("proyecto");
		Long objetivo = fila("objetivo");
		guardar("a", proyecto1, null);
		guardar("b", proyecto2, null);
		guardar("c", null, objetivo);
		guardar("libre", null, null);

		assertThat(titulos(repository.findByUsuarioIdAndProyectoIdIn(1L, List.of(proyecto1, proyecto2))))
				.containsExactlyInAnyOrder("a", "b");
		assertThat(titulos(repository.findByUsuarioIdAndProyectoIdIn(1L, List.of(proyecto1)))).containsExactly("a");
		assertThat(titulos(repository.findByUsuarioIdAndObjetivoIdIn(1L, List.of(objetivo)))).containsExactly("c");
		assertThat(repository.findByUsuarioIdAndProyectoIdIn(2L, List.of(proyecto1))).isEmpty();
		assertThat(repository.findByUsuarioIdAndObjetivoIdIn(1L, List.of(999_999L))).isEmpty();
	}

	@Test
	void filtraPorProyectoYPorObjetivo() {
		Long proyecto = fila("proyecto");
		Long objetivo = fila("objetivo");
		guardar("en-proyecto", proyecto, null);
		guardar("en-objetivo", null, objetivo);
		guardar("libre", null, null);

		assertThat(titulos(repository.listar(1L, null, proyecto, null, false))).containsExactly("en-proyecto");
		assertThat(titulos(repository.listar(1L, null, null, objetivo, false))).containsExactly("en-objetivo");
	}

	@Test
	void filtraPorEstado() {
		Long proyecto = fila("proyecto");
		guardar("planteada", proyecto, null);
		Idea cerrada = nueva("concluida");
		cerrada.setProyectoId(proyecto);
		cerrada.setEstado(EstadoIdea.CONCLUIDA);
		repository.saveAndFlush(cerrada);

		assertThat(titulos(repository.listar(1L, EstadoIdea.CONCLUIDA, proyecto, null, false)))
				.containsExactly("concluida");
		assertThat(titulos(repository.listar(1L, EstadoIdea.PLANTEADA, proyecto, null, false)))
				.containsExactly("planteada");
		assertThat(titulos(repository.listar(1L, null, proyecto, null, false)))
				.containsExactlyInAnyOrder("planteada", "concluida");
	}

	@Test
	void libresDevuelveSoloLasIdeasSinVinculo() {
		Long proyecto = fila("proyecto");
		Long objetivo = fila("objetivo");
		guardar("zz-libre", null, null);
		guardar("zz-en-proyecto", proyecto, null);
		guardar("zz-en-objetivo", null, objetivo);

		List<String> libres = titulos(repository.listar(1L, null, null, null, true));
		assertThat(libres).contains("zz-libre").doesNotContain("zz-en-proyecto", "zz-en-objetivo");

		List<String> todas = titulos(repository.listar(1L, null, null, null, false));
		assertThat(todas).contains("zz-libre", "zz-en-proyecto", "zz-en-objetivo");
	}

	@Test
	void ordenaPorFechaDeCreacionDescYLuegoIdDesc() {
		Long proyecto = fila("proyecto");
		// now() es constante dentro de una transacción: las tres tendrían la misma fecha_creacion.
		Idea vieja = guardar("vieja", proyecto, null);
		Idea a = guardar("misma-fecha-1", proyecto, null);
		Idea b = guardar("misma-fecha-2", proyecto, null);
		em.createNativeQuery("UPDATE idea SET fecha_creacion = now() - interval '1 day' WHERE id = :id")
				.setParameter("id", vieja.getId()).executeUpdate();
		em.clear();

		assertThat(titulos(repository.listar(1L, null, proyecto, null, false)))
				.containsExactly("misma-fecha-2", "misma-fecha-1", "vieja");
		assertThat(b.getId()).isGreaterThan(a.getId());
	}

	@Test
	void laBaseRechazaUnProyectoYUnObjetivoAlMismoTiempo() {
		Long proyecto = fila("proyecto");
		Long objetivo = fila("objetivo");

		assertThatThrownBy(() -> guardar("ambos", proyecto, objetivo)).isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaUnProyectoInexistente() {
		assertThatThrownBy(() -> guardar("huérfana", 999_999L, null)).isInstanceOf(Exception.class);
	}
}
