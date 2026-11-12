package com.agoals.tarea;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;
import com.agoals.tarea.dto.AgendarRequest;
import com.agoals.tarea.dto.TareaRecomendadaResponse;
import com.agoals.tarea.dto.TareaResponse;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// Recomendación con horizonte (5c) usando el repository REAL contra el PostgreSQL de Docker. La base de desarrollo
// tiene datos reales y el límite por defecto es 50: por eso todo se filtra por un proyecto propio del test, con
// limite=200, y se verifica por ids propios, nunca por tamaño de lista. Cada test hace rollback al terminar.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TareaService.class)
class TareaServiceRecomendacionIntegracionTest {

	private static final LocalDate HOY = LocalDate.of(2097, 3, 10);
	private static final LocalDate HASTA = HOY.plusDays(5);

	@Autowired
	TareaService service;

	@Autowired
	TareaRepository repository;

	@Autowired
	EntityManager em;

	private Long proyectoId;

	@BeforeEach
	void crearProyecto() {
		proyectoId = ((Number) em.createNativeQuery(
				"INSERT INTO proyecto (usuario_id, nombre) VALUES (1, 'it-5c') RETURNING id").getSingleResult())
				.longValue();
	}

	private Tarea guardar(String titulo, LocalDate fecha, Prioridad prioridad, Tarea padre) {
		Tarea t = new Tarea();
		t.setUsuarioId(TareaService.USUARIO_ID);
		t.setTitulo(titulo);
		t.setFecha(fecha);
		t.setPrioridad(prioridad);
		t.setPadreId(padre == null ? null : padre.getId());
		t.setProyectoId(proyectoId);
		return repository.saveAndFlush(t);
	}

	private List<TareaRecomendadaResponse> recomendar(LocalDate hasta) {
		return service.recomendacion(HOY, null, null, 200, proyectoId, null, hasta);
	}

	private static List<Long> ids(List<TareaRecomendadaResponse> raices) {
		return raices.stream().map(r -> r.tarea().id()).toList();
	}

	private static void aplanar(TareaRecomendadaResponse nodo, List<Long> salida) {
		nodo.subtareas().forEach(h -> {
			salida.add(h.tarea().id());
			aplanar(h, salida);
		});
	}

	@Test
	void sinHastaUnaFuturaNoApareceYConHastaSiAlFinal() {
		Tarea sinFecha = guardar("it sin fecha", null, null, null);
		Tarea atrasada = guardar("it atrasada", HOY.minusDays(1), null, null);
		Tarea deHoy = guardar("it de hoy", HOY, null, null);
		Tarea futura = guardar("it futura", HOY.plusDays(2), Prioridad.ALTA, null);
		Tarea enHasta = guardar("it en hasta", HASTA, null, null);
		Tarea masAlla = guardar("it mas alla", HASTA.plusDays(1), null, null);
		Tarea hechaFutura = guardar("it hecha futura", HOY.plusDays(2), null, null);
		hechaFutura.setEstado(Estado.HECHO);
		repository.saveAndFlush(hechaFutura);

		List<Long> sin = ids(service.recomendacion(HOY, null, null, 200, proyectoId, null));
		assertThat(sin).containsExactlyInAnyOrder(sinFecha.getId(), atrasada.getId())
				.doesNotContain(futura.getId(), enHasta.getId());

		List<Long> con = ids(recomendar(HASTA));
		// Bloque actual (prioridad desc, id) y luego el futuro (fecha asc).
		assertThat(con).containsExactly(sinFecha.getId(), atrasada.getId(), futura.getId(), enHasta.getId());
		assertThat(con).doesNotContain(deHoy.getId(), masAlla.getId(), hechaFutura.getId());

		assertThat(ids(recomendar(HOY))).containsExactly(sinFecha.getId(), atrasada.getId());
	}

	@Test
	void conHastaLaVistaPreviaDeUnaMadreFuturaCoincideConLoQueMueveAgendar() {
		Tarea madre = guardar("it madre futura", HOY.plusDays(2), Prioridad.ALTA, null);
		Tarea hijaSinFecha = guardar("it hija sin fecha", null, Prioridad.BAJA, madre);
		Tarea hijaAtrasada = guardar("it hija atrasada", HOY.minusDays(3), Prioridad.ALTA, madre);
		Tarea nieta = guardar("it nieta sin fecha", null, null, hijaAtrasada);
		Tarea hijaFutura = guardar("it hija futura", HOY.plusDays(3), null, madre);
		Tarea hijaDeHoy = guardar("it hija de hoy", HOY, null, madre);
		em.flush();
		em.clear();

		List<TareaRecomendadaResponse> raices = recomendar(HASTA);
		// Solo la madre es raíz: sus hijas actuales van anidadas y las hijas de hoy/futuras no se muestran.
		assertThat(ids(raices)).containsExactly(madre.getId());
		List<Long> esperado = new ArrayList<>(List.of(madre.getId()));
		aplanar(raices.get(0), esperado);
		assertThat(esperado).containsExactly(madre.getId(), hijaAtrasada.getId(), nieta.getId(), hijaSinFecha.getId());

		List<Long> movidas = service.agendar(madre.getId(), new AgendarRequest(HOY, HOY, true)).stream()
				.map(TareaResponse::id).toList();
		em.flush();
		em.clear();

		assertThat(movidas).containsExactlyElementsOf(esperado);
		assertThat(repository.findById(hijaFutura.getId()).orElseThrow().getFecha()).isEqualTo(HOY.plusDays(3));
		assertThat(repository.findById(hijaDeHoy.getId()).orElseThrow().getFecha()).isEqualTo(HOY);
		assertThat(repository.findById(madre.getId()).orElseThrow().getFecha()).isEqualTo(HOY);
	}
}
