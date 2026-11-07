package com.agoals.proyecto;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;
import com.agoals.idea.IdeaService;
import com.agoals.objetivo.ObjetivoConsultaService;
import com.agoals.objetivo.ObjetivoInvalidoException;
import com.agoals.proyecto.dto.ProyectoRequest;
import com.agoals.proyecto.dto.ProyectoResponse;
import com.agoals.tarea.TareaService;
import com.agoals.tarea.dto.TareaResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProyectoServiceTest {

	private static final Long U = ProyectoService.USUARIO_ID;

	@Mock
	ProyectoRepository repository;

	@Mock
	TareaService tareaService;

	@Mock
	ObjetivoConsultaService objetivoConsultaService;

	@Mock
	IdeaService ideaService;

	@InjectMocks
	ProyectoService service;

	private static ProyectoRequest request(Long padreId, Long objetivoId) {
		return new ProyectoRequest("Casa", "reformas", null, Prioridad.ALTA, padreId, objetivoId);
	}

	private static Proyecto proyecto(long id, Long padreId) {
		Proyecto p = new Proyecto();
		ReflectionTestUtils.setField(p, "id", id);
		p.setUsuarioId(U);
		p.setNombre("p" + id);
		p.setPadreId(padreId);
		return p;
	}

	/** Hace que el repository encuentre este proyecto por id. */
	private Proyecto existe(Proyecto p) {
		when(repository.findByIdAndUsuarioId(p.getId(), U)).thenReturn(Optional.of(p));
		return p;
	}

	private void noExiste(long id) {
		when(repository.findByIdAndUsuarioId(id, U)).thenReturn(Optional.empty());
	}

	private static TareaResponse tareaEn(Long proyectoId) {
		return new TareaResponse(5L, "t", null, Estado.PENDIENTE, null, null, null, null, null, proyectoId, null, 0, null);
	}

	// ---- Crear ----

	@Test
	void crearAplicaEstadoPorDefectoYUsuarioFijo() {
		when(repository.saveAndFlush(any(Proyecto.class))).thenAnswer(inv -> inv.getArgument(0));

		ProyectoResponse r = service.crear(request(null, null));

		ArgumentCaptor<Proyecto> captor = ArgumentCaptor.forClass(Proyecto.class);
		verify(repository).saveAndFlush(captor.capture());
		assertThat(captor.getValue().getUsuarioId()).isEqualTo(U);
		assertThat(r.estado()).isEqualTo(Estado.PENDIENTE);
		assertThat(r.nombre()).isEqualTo("Casa");
		assertThat(r.prioridad()).isEqualTo(Prioridad.ALTA);
	}

	@Test
	void crearSinDescripcionGuardaCadenaVacia() {
		when(repository.saveAndFlush(any(Proyecto.class))).thenAnswer(inv -> inv.getArgument(0));

		ProyectoResponse r = service.crear(new ProyectoRequest("Casa", null, null, null, null, null));

		assertThat(r.descripcion()).isEmpty();
	}

	@Test
	void crearConPadreExistenteFunciona() {
		existe(proyecto(4, null));
		when(repository.saveAndFlush(any(Proyecto.class))).thenAnswer(inv -> inv.getArgument(0));

		assertThat(service.crear(request(4L, null)).padreId()).isEqualTo(4L);
	}

	@Test
	void crearConPadreInexistenteFalla() {
		noExiste(9);

		assertThatThrownBy(() -> service.crear(request(9L, null)))
				.isInstanceOf(ProyectoInvalidoException.class)
				.hasMessageContaining("padre no existe");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void crearConObjetivoExistenteLoValidaYLoGuarda() {
		when(repository.saveAndFlush(any(Proyecto.class))).thenAnswer(inv -> inv.getArgument(0));

		ProyectoResponse r = service.crear(request(null, 3L));

		verify(objetivoConsultaService).validarExiste(3L);
		assertThat(r.objetivoId()).isEqualTo(3L);
	}

	@Test
	void crearConObjetivoInexistenteDa400YNoGuarda() {
		doThrow(new ObjetivoInvalidoException("El objetivo no existe: 77"))
				.when(objetivoConsultaService).validarExiste(77L);

		assertThatThrownBy(() -> service.crear(request(null, 77L)))
				.isInstanceOf(ObjetivoInvalidoException.class)
				.hasMessage("El objetivo no existe: 77");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void crearSinObjetivoNoConsultaObjetivos() {
		when(repository.saveAndFlush(any(Proyecto.class))).thenAnswer(inv -> inv.getArgument(0));

		service.crear(request(null, null));

		verifyNoInteractions(objetivoConsultaService);
	}

	@Test
	void actualizarConObjetivoInexistenteDa400YNoGuarda() {
		existe(proyecto(1, null));
		doThrow(new ObjetivoInvalidoException("El objetivo no existe: 77"))
				.when(objetivoConsultaService).validarExiste(77L);

		assertThatThrownBy(() -> service.actualizar(1L, request(null, 77L)))
				.isInstanceOf(ObjetivoInvalidoException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void actualizarQuitandoElObjetivoNoConsultaObjetivos() {
		Proyecto p = existe(proyecto(1, null));
		p.setObjetivoId(3L);
		when(repository.saveAndFlush(p)).thenReturn(p);

		assertThat(service.actualizar(1L, request(null, null)).objetivoId()).isNull();
		verifyNoInteractions(objetivoConsultaService);
	}

	// ---- Obtener / listar ----

	@Test
	void obtenerInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.obtener(1L)).isInstanceOf(ProyectoNoEncontradoException.class);
	}

	@Test
	void listarPasaLosFiltrosAlRepository() {
		when(repository.listar(U, Estado.EN_PROGRESO, 3L)).thenReturn(List.of(proyecto(1, null)));

		assertThat(service.listar(Estado.EN_PROGRESO, 3L)).extracting(ProyectoResponse::id).containsExactly(1L);
	}

	@Test
	void listarSinFiltrosPasaNulls() {
		when(repository.listar(U, null, null)).thenReturn(List.of());

		assertThat(service.listar(null, null)).isEmpty();
	}

	// ---- Actualizar y jerarquía ----

	@Test
	void actualizarInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.actualizar(1L, request(null, null)))
				.isInstanceOf(ProyectoNoEncontradoException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void actualizarCambiaLosCampos() {
		Proyecto p = existe(proyecto(1, null));
		when(repository.saveAndFlush(p)).thenReturn(p);

		ProyectoResponse r = service.actualizar(1L,
				new ProyectoRequest("Nuevo", "d", Estado.EN_PAUSA, Prioridad.BAJA, null, null));

		assertThat(r.nombre()).isEqualTo("Nuevo");
		assertThat(r.estado()).isEqualTo(Estado.EN_PAUSA);
		assertThat(r.prioridad()).isEqualTo(Prioridad.BAJA);
	}

	@Test
	void unProyectoNoPuedeSerSuPropioPadre() {
		existe(proyecto(1, null));

		assertThatThrownBy(() -> service.actualizar(1L, request(1L, null)))
				.isInstanceOf(ProyectoInvalidoException.class)
				.hasMessageContaining("propio padre");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void ponerUnProyectoBajoSuHijoDirectoEsCiclo() {
		existe(proyecto(1, null));
		existe(proyecto(2, 1L));

		assertThatThrownBy(() -> service.actualizar(1L, request(2L, null)))
				.isInstanceOf(ProyectoInvalidoException.class)
				.hasMessageContaining("Ciclo");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void ponerUnProyectoBajoUnDescendienteIndirectoEsCiclo() {
		// 1 -> 2 -> 3 (3 es nieto de 1): poner 1 bajo 3 cerraría el ciclo.
		existe(proyecto(1, null));
		existe(proyecto(2, 1L));
		existe(proyecto(3, 2L));

		assertThatThrownBy(() -> service.actualizar(1L, request(3L, null)))
				.isInstanceOf(ProyectoInvalidoException.class)
				.hasMessageContaining("Ciclo");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void moverBajoUnProyectoDeOtraRamaEsValido() {
		// Ramas: 1 -> 2 y 4 -> 5. Mover 2 bajo 5 no es ciclo.
		Proyecto dos = existe(proyecto(2, 1L));
		existe(proyecto(5, 4L));
		existe(proyecto(4, null));
		when(repository.saveAndFlush(dos)).thenReturn(dos);

		assertThat(service.actualizar(2L, request(5L, null)).padreId()).isEqualTo(5L);
	}

	@Test
	void sacarUnProyectoDeSuPadreEsValido() {
		Proyecto dos = existe(proyecto(2, 1L));
		when(repository.saveAndFlush(dos)).thenReturn(dos);

		assertThat(service.actualizar(2L, request(null, null)).padreId()).isNull();
	}

	@Test
	void cambiarElEstadoNoPropagaANingunaTarea() {
		Proyecto p = existe(proyecto(1, null));
		when(repository.saveAndFlush(p)).thenReturn(p);

		service.actualizar(1L, new ProyectoRequest("Casa", null, Estado.HECHO, null, null, null));

		verifyNoInteractions(tareaService);
		verify(repository, never()).findAll();
	}

	// ---- Eliminar ----

	@Test
	void eliminarInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.eliminar(1L)).isInstanceOf(ProyectoNoEncontradoException.class);
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarConSubproyectosDa409() {
		existe(proyecto(1, null));
		when(repository.existsByPadreIdAndUsuarioId(1L, U)).thenReturn(true);

		assertThatThrownBy(() -> service.eliminar(1L))
				.isInstanceOf(ProyectoConDependenciasException.class)
				.hasMessageContaining("subproyectos");
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarConTareasDa409() {
		existe(proyecto(1, null));
		when(repository.existsByPadreIdAndUsuarioId(1L, U)).thenReturn(false);
		when(tareaService.existenTareasDelProyecto(1L)).thenReturn(true);

		assertThatThrownBy(() -> service.eliminar(1L))
				.isInstanceOf(ProyectoConDependenciasException.class)
				.hasMessageContaining("tareas");
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarConIdeasDa409() {
		existe(proyecto(1, null));
		when(repository.existsByPadreIdAndUsuarioId(1L, U)).thenReturn(false);
		when(tareaService.existenTareasDelProyecto(1L)).thenReturn(false);
		when(ideaService.existenIdeasDelProyecto(1L)).thenReturn(true);

		assertThatThrownBy(() -> service.eliminar(1L))
				.isInstanceOf(ProyectoConDependenciasException.class)
				.hasMessageContaining("ideas");
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarUnProyectoVacioLoBorra() {
		Proyecto p = existe(proyecto(1, null));
		when(repository.existsByPadreIdAndUsuarioId(1L, U)).thenReturn(false);
		when(tareaService.existenTareasDelProyecto(1L)).thenReturn(false);
		when(ideaService.existenIdeasDelProyecto(1L)).thenReturn(false);

		service.eliminar(1L);

		verify(repository).delete(p);
	}

	// ---- Soporte para objetivo ----

	@Test
	void existenProyectosDelObjetivoDelegaEnElRepository() {
		when(repository.existsByObjetivoIdAndUsuarioId(3L, U)).thenReturn(true);
		when(repository.existsByObjetivoIdAndUsuarioId(4L, U)).thenReturn(false);

		assertThat(service.existenProyectosDelObjetivo(3L)).isTrue();
		assertThat(service.existenProyectosDelObjetivo(4L)).isFalse();
	}

	// ---- Tareas del proyecto ----

	@Test
	void listarTareasDelegaEnTareaService() {
		existe(proyecto(1, null));
		when(tareaService.listarPorProyecto(1L)).thenReturn(List.of(tareaEn(1L)));

		assertThat(service.listarTareas(1L)).hasSize(1);
	}

	@Test
	void listarTareasDeUnProyectoInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.listarTareas(1L)).isInstanceOf(ProyectoNoEncontradoException.class);
		verifyNoInteractions(tareaService);
	}

	@Test
	void asignarTareaDelegaYDevuelveLaTarea() {
		existe(proyecto(1, null));
		when(tareaService.asignarProyecto(5L, 1L)).thenReturn(tareaEn(1L));

		assertThat(service.asignarTarea(1L, 5L).proyectoId()).isEqualTo(1L);
	}

	@Test
	void asignarTareaAUnProyectoInexistenteFallaSinTocarLaTarea() {
		noExiste(1);

		assertThatThrownBy(() -> service.asignarTarea(1L, 5L)).isInstanceOf(ProyectoNoEncontradoException.class);
		verifyNoInteractions(tareaService);
	}

	@Test
	void desasignarQuitaElProyectoDeLaTarea() {
		existe(proyecto(1, null));
		when(tareaService.obtener(5L)).thenReturn(tareaEn(1L));

		service.desasignarTarea(1L, 5L);

		verify(tareaService).asignarProyecto(5L, null);
	}

	@Test
	void desasignarUnaTareaDeOtroProyectoFalla() {
		existe(proyecto(1, null));
		when(tareaService.obtener(5L)).thenReturn(tareaEn(2L));

		assertThatThrownBy(() -> service.desasignarTarea(1L, 5L))
				.isInstanceOf(ProyectoInvalidoException.class)
				.hasMessageContaining("no pertenece");
		verify(tareaService, never()).asignarProyecto(any(), any());
	}

	@Test
	void desasignarUnaTareaSinProyectoFalla() {
		existe(proyecto(1, null));
		when(tareaService.obtener(5L)).thenReturn(tareaEn(null));

		assertThatThrownBy(() -> service.desasignarTarea(1L, 5L)).isInstanceOf(ProyectoInvalidoException.class);
		verify(tareaService, never()).asignarProyecto(any(), any());
	}

	@Test
	void desasignarDeUnProyectoInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.desasignarTarea(1L, 5L)).isInstanceOf(ProyectoNoEncontradoException.class);
		verifyNoInteractions(tareaService);
	}
}
