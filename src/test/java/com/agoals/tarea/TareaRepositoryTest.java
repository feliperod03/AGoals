package com.agoals.tarea;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Usa el PostgreSQL real de Docker (con Flyway aplicado) para validar el mapeo contra el esquema.
// Cada test hace rollback al terminar.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TareaRepositoryTest {

	@Autowired
	TareaRepository repository;

	@Autowired
	jakarta.persistence.EntityManager em;

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
	void unProyectoIdInexistenteViolaLaFk() {
		Tarea t = nueva("huérfana");
		t.setProyectoId(999_999L);

		assertThatThrownBy(() -> repository.saveAndFlush(t)).isInstanceOf(Exception.class);
	}

	@Test
	void buscaYDetectaTareasPorProyecto() {
		// El módulo proyecto todavía no está en este tramo: se inserta la fila con SQL nativo.
		Long proyectoId = ((Number) em.createNativeQuery(
				"INSERT INTO proyecto (usuario_id, nombre) VALUES (1, 'p') RETURNING id").getSingleResult())
				.longValue();
		Tarea dentro = nueva("dentro");
		dentro.setProyectoId(proyectoId);
		repository.saveAndFlush(dentro);
		repository.saveAndFlush(nueva("suelta"));

		assertThat(repository.findByUsuarioIdAndProyectoIdIn(1L, List.of(proyectoId)))
				.extracting(Tarea::getTitulo).containsExactly("dentro");
		assertThat(repository.findByUsuarioIdAndProyectoIdOrderByFechaAscIdAsc(1L, proyectoId))
				.extracting(Tarea::getTitulo).containsExactly("dentro");
		assertThat(repository.findByUsuarioIdAndProyectoIdIn(2L, List.of(proyectoId))).isEmpty();
	}

	@Test
	void buscaYDetectaTareasPorObjetivo() {
		// El módulo objetivo todavía no está en este tramo: se inserta la fila con SQL nativo.
		Long objetivoId = ((Number) em.createNativeQuery(
				"INSERT INTO objetivo (usuario_id, nombre) VALUES (1, 'o') RETURNING id").getSingleResult())
				.longValue();
		Tarea dentro = nueva("dentro");
		dentro.setObjetivoId(objetivoId);
		repository.saveAndFlush(dentro);
		repository.saveAndFlush(nueva("suelta"));

		assertThat(repository.findByUsuarioIdAndObjetivoIdIn(1L, List.of(objetivoId)))
				.extracting(Tarea::getTitulo).containsExactly("dentro");
		assertThat(repository.findByUsuarioIdAndObjetivoIdOrderByFechaAscIdAsc(1L, objetivoId))
				.extracting(Tarea::getTitulo).containsExactly("dentro");
		assertThat(repository.findByUsuarioIdAndObjetivoIdIn(2L, List.of(objetivoId))).isEmpty();
	}

	@Test
	void unObjetivoIdInexistenteViolaLaFk() {
		Tarea t = nueva("huérfana");
		t.setObjetivoId(999_999L);

		assertThatThrownBy(() -> repository.saveAndFlush(t)).isInstanceOf(Exception.class);
	}

	@Test
	void existsByPadreIdDetectaSubtareas() {
		Tarea madre = repository.saveAndFlush(nueva("madre"));
		Tarea sola = repository.saveAndFlush(nueva("sola"));
		Tarea hija = nueva("hija");
		hija.setPadreId(madre.getId());
		repository.saveAndFlush(hija);

		assertThat(repository.existsByPadreIdAndUsuarioId(madre.getId(), 1L)).isTrue();
		assertThat(repository.existsByPadreIdAndUsuarioId(sola.getId(), 1L)).isFalse();
		assertThat(repository.existsByPadreIdAndUsuarioId(madre.getId(), 2L)).isFalse();
	}

	@Test
	void atrasadasFiltraPorFechaEstrictaEstadoYUsuario() {
		LocalDate hoy = LocalDate.of(2026, 11, 6);
		List<Estado> abiertos = List.of(Estado.PENDIENTE, Estado.EN_PROGRESO, Estado.EN_PAUSA);
		Tarea vieja = nueva("vieja pendiente");
		vieja.setFecha(hoy.minusDays(3));
		Tarea enProgreso = nueva("ayer en progreso");
		enProgreso.setFecha(hoy.minusDays(1));
		enProgreso.setEstado(Estado.EN_PROGRESO);
		Tarea enPausa = nueva("ayer en pausa");
		enPausa.setFecha(hoy.minusDays(1));
		enPausa.setEstado(Estado.EN_PAUSA);
		Tarea hecha = nueva("vieja hecha");
		hecha.setFecha(hoy.minusDays(3));
		hecha.setEstado(Estado.HECHO);
		Tarea cancelada = nueva("vieja cancelada");
		cancelada.setFecha(hoy.minusDays(3));
		cancelada.setEstado(Estado.CANCELADO);
		Tarea deHoy = nueva("de hoy");
		deHoy.setFecha(hoy);
		Tarea futura = nueva("futura");
		futura.setFecha(hoy.plusDays(1));
		Tarea sinFecha = nueva("sin agendar");
		repository.saveAllAndFlush(List.of(vieja, enProgreso, enPausa, hecha, cancelada, deHoy, futura, sinFecha));

		List<Tarea> r = repository.findByUsuarioIdAndFechaBeforeAndEstadoIn(1L, hoy, abiertos);

		// La base puede tener tareas del usuario: se comprueba lo propio con contains / doesNotContain.
		assertThat(r).extracting(Tarea::getTitulo)
				.contains("vieja pendiente", "ayer en progreso", "ayer en pausa")
				.doesNotContain("vieja hecha", "vieja cancelada", "de hoy", "futura", "sin agendar");
		assertThat(repository.findByUsuarioIdAndFechaBeforeAndEstadoIn(2L, hoy, abiertos)).isEmpty();
	}

	@Test
	void laBaseRechazaHoraSinFecha() {
		Tarea t = nueva("invalida");
		t.setHoraInicio(LocalTime.of(9, 0));

		assertThatThrownBy(() -> repository.saveAndFlush(t)).isInstanceOf(Exception.class);
	}

	@Test
	void candidatasRecomendacionIncluyeSinFechaYAtrasadasAbiertasDelUsuario() {
		LocalDate hoy = LocalDate.of(2026, 11, 6);
		List<Estado> abiertos = List.of(Estado.PENDIENTE, Estado.EN_PROGRESO, Estado.EN_PAUSA);
		Tarea sinFecha = nueva("rc sin fecha");
		Tarea atrasada = nueva("rc atrasada");
		atrasada.setFecha(hoy.minusDays(2));
		Tarea enPausaSinFecha = nueva("rc en pausa");
		enPausaSinFecha.setEstado(Estado.EN_PAUSA);
		Tarea deHoy = nueva("rc de hoy");
		deHoy.setFecha(hoy);
		Tarea futura = nueva("rc futura");
		futura.setFecha(hoy.plusDays(1));
		Tarea hechaSinFecha = nueva("rc hecha");
		hechaSinFecha.setEstado(Estado.HECHO);
		Tarea canceladaAtrasada = nueva("rc cancelada");
		canceladaAtrasada.setEstado(Estado.CANCELADO);
		canceladaAtrasada.setFecha(hoy.minusDays(2));
		repository.saveAllAndFlush(List.of(sinFecha, atrasada, enPausaSinFecha, deHoy, futura,
				hechaSinFecha, canceladaAtrasada));

		List<Tarea> r = repository.findCandidatasRecomendacion(1L, hoy, abiertos);

		// La base puede tener tareas del usuario: se comprueba lo propio con contains / doesNotContain.
		assertThat(r).extracting(Tarea::getTitulo)
				.contains("rc sin fecha", "rc atrasada", "rc en pausa")
				.doesNotContain("rc de hoy", "rc futura", "rc hecha", "rc cancelada");
		assertThat(repository.findCandidatasRecomendacion(2L, hoy, abiertos)).isEmpty();
	}

	@Test
	void futurasRecomendacionRespetaBordesYEstados() {
		LocalDate hoy = LocalDate.of(2097, 3, 10);
		LocalDate hasta = hoy.plusDays(5);
		List<Estado> abiertos = List.of(Estado.PENDIENTE, Estado.EN_PROGRESO, Estado.EN_PAUSA);
		Tarea manana = nueva("fu manana");
		manana.setFecha(hoy.plusDays(1));
		Tarea enHasta = nueva("fu en hasta");
		enHasta.setFecha(hasta);
		enHasta.setEstado(Estado.EN_PROGRESO);
		Tarea enPausa = nueva("fu en pausa");
		enPausa.setFecha(hoy.plusDays(2));
		enPausa.setEstado(Estado.EN_PAUSA);
		Tarea deHoy = nueva("fu de hoy");
		deHoy.setFecha(hoy);
		Tarea pasadoHasta = nueva("fu hasta mas uno");
		pasadoHasta.setFecha(hasta.plusDays(1));
		Tarea atrasada = nueva("fu atrasada");
		atrasada.setFecha(hoy.minusDays(1));
		Tarea sinFecha = nueva("fu sin fecha");
		Tarea hecha = nueva("fu hecha");
		hecha.setFecha(hoy.plusDays(2));
		hecha.setEstado(Estado.HECHO);
		Tarea cancelada = nueva("fu cancelada");
		cancelada.setFecha(hoy.plusDays(2));
		cancelada.setEstado(Estado.CANCELADO);
		repository.saveAllAndFlush(List.of(manana, enHasta, enPausa, deHoy, pasadoHasta, atrasada, sinFecha, hecha,
				cancelada));

		List<Tarea> r = repository.findFuturasRecomendacion(1L, hoy, hasta, abiertos);

		// La base puede tener tareas del usuario: se comprueba lo propio con contains / doesNotContain.
		assertThat(r).extracting(Tarea::getTitulo)
				.contains("fu manana", "fu en hasta", "fu en pausa")
				.doesNotContain("fu de hoy", "fu hasta mas uno", "fu atrasada", "fu sin fecha", "fu hecha", "fu cancelada");
		assertThat(repository.findFuturasRecomendacion(2L, hoy, hasta, abiertos)).isEmpty();
	}

	@Test
	void candidatasRecomendacionTraeTareasConCualquierVinculoYPadre() {
		LocalDate hoy = LocalDate.of(2026, 11, 6);
		List<Estado> abiertos = List.of(Estado.PENDIENTE, Estado.EN_PROGRESO, Estado.EN_PAUSA);
		Long proyectoId = ((Number) em.createNativeQuery(
				"INSERT INTO proyecto (usuario_id, nombre) VALUES (1, 'p') RETURNING id").getSingleResult())
				.longValue();
		Long objetivoId = ((Number) em.createNativeQuery(
				"INSERT INTO objetivo (usuario_id, nombre) VALUES (1, 'o') RETURNING id").getSingleResult())
				.longValue();
		Tarea madre = nueva("rv madre");
		repository.saveAndFlush(madre);
		Tarea hija = nueva("rv hija");
		hija.setPadreId(madre.getId());
		Tarea conProyecto = nueva("rv proyecto");
		conProyecto.setProyectoId(proyectoId);
		Tarea conObjetivo = nueva("rv objetivo");
		conObjetivo.setObjetivoId(objetivoId);
		Tarea conAmbos = nueva("rv ambos");
		conAmbos.setProyectoId(proyectoId);
		conAmbos.setObjetivoId(objetivoId);
		repository.saveAllAndFlush(List.of(hija, conProyecto, conObjetivo, conAmbos));

		// El repository no filtra por proyecto/objetivo: devuelve todas y el service decide.
		assertThat(repository.findCandidatasRecomendacion(1L, hoy, abiertos)).extracting(Tarea::getTitulo)
				.contains("rv madre", "rv hija", "rv proyecto", "rv objetivo", "rv ambos");
	}
}
