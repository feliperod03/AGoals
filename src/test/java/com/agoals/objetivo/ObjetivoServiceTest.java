package com.agoals.objetivo;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;
import com.agoals.idea.IdeaService;
import com.agoals.objetivo.dto.ObjetivoRequest;
import com.agoals.objetivo.dto.ObjetivoResponse;
import com.agoals.proyecto.ProyectoService;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ObjetivoServiceTest {

	private static final Long U = ObjetivoService.USUARIO_ID;

	@Mock
	ObjetivoRepository repository;

	@Mock
	ProyectoService proyectoService;

	@Mock
	TareaService tareaService;

	@Mock
	IdeaService ideaService;

	@InjectMocks
	ObjetivoService service;

	private static ObjetivoRequest request(Long padreId) {
		return new ObjetivoRequest("Aprender inglés", "nivel B2", null, Prioridad.ALTA, padreId);
	}

	private static Objetivo objetivo(long id, Long padreId) {
		Objetivo o = new Objetivo();
		ReflectionTestUtils.setField(o, "id", id);
		o.setUsuarioId(U);
		o.setNombre("o" + id);
		o.setPadreId(padreId);
		return o;
	}

	private Objetivo existe(Objetivo o) {
		when(repository.findByIdAndUsuarioId(o.getId(), U)).thenReturn(Optional.of(o));
		return o;
	}

	private void noExiste(long id) {
		when(repository.findByIdAndUsuarioId(id, U)).thenReturn(Optional.empty());
	}

	private static TareaResponse tareaEn(Long objetivoId) {
		return new TareaResponse(5L, "t", null, Estado.PENDIENTE, null, null, null, null, null, null, objetivoId, 0, null);
	}

	// ---- Crear ----

	@Test
	void crearAplicaEstadoPorDefectoYUsuarioFijo() {
		when(repository.saveAndFlush(any(Objetivo.class))).thenAnswer(inv -> inv.getArgument(0));

		ObjetivoResponse r = service.crear(request(null));

		ArgumentCaptor<Objetivo> captor = ArgumentCaptor.forClass(Objetivo.class);
		verify(repository).saveAndFlush(captor.capture());
		assertThat(captor.getValue().getUsuarioId()).isEqualTo(U);
		assertThat(r.estado()).isEqualTo(Estado.PENDIENTE);
		assertThat(r.nombre()).isEqualTo("Aprender inglés");
		assertThat(r.prioridad()).isEqualTo(Prioridad.ALTA);
	}

	@Test
	void crearSinDescripcionGuardaCadenaVacia() {
		when(repository.saveAndFlush(any(Objetivo.class))).thenAnswer(inv -> inv.getArgument(0));

		assertThat(service.crear(new ObjetivoRequest("x", null, null, null, null)).descripcion()).isEmpty();
	}

	@Test
	void crearConPadreExistenteFunciona() {
		existe(objetivo(4, null));
		when(repository.saveAndFlush(any(Objetivo.class))).thenAnswer(inv -> inv.getArgument(0));

		assertThat(service.crear(request(4L)).padreId()).isEqualTo(4L);
	}

	@Test
	void crearConPadreInexistenteFalla() {
		noExiste(9);

		assertThatThrownBy(() -> service.crear(request(9L)))
				.isInstanceOf(ObjetivoInvalidoException.class)
				.hasMessageContaining("objetivo padre no existe");
		verify(repository, never()).saveAndFlush(any());
	}

	// ---- Obtener / listar ----

	@Test
	void obtenerInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.obtener(1L)).isInstanceOf(ObjetivoNoEncontradoException.class);
	}

	@Test
	void listarPasaElFiltroAlRepository() {
		when(repository.listar(U, Estado.EN_PROGRESO)).thenReturn(List.of(objetivo(1, null)));

		assertThat(service.listar(Estado.EN_PROGRESO)).extracting(ObjetivoResponse::id).containsExactly(1L);
	}

	@Test
	void listarSinFiltroPasaNull() {
		when(repository.listar(U, null)).thenReturn(List.of());

		assertThat(service.listar(null)).isEmpty();
	}

	// ---- Actualizar y jerarquía ----

	@Test
	void actualizarInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.actualizar(1L, request(null)))
				.isInstanceOf(ObjetivoNoEncontradoException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void actualizarCambiaLosCamposSinPropagarEstados() {
		Objetivo o = existe(objetivo(1, null));
		when(repository.saveAndFlush(o)).thenReturn(o);

		ObjetivoResponse r = service.actualizar(1L,
				new ObjetivoRequest("Nuevo", "d", Estado.HECHO, Prioridad.BAJA, null));

		assertThat(r.nombre()).isEqualTo("Nuevo");
		assertThat(r.estado()).isEqualTo(Estado.HECHO);
		verifyNoInteractions(proyectoService, tareaService);
	}

	@Test
	void unObjetivoNoPuedeSerSuPropioPadre() {
		existe(objetivo(1, null));

		assertThatThrownBy(() -> service.actualizar(1L, request(1L)))
				.isInstanceOf(ObjetivoInvalidoException.class)
				.hasMessageContaining("propio padre");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void ponerUnObjetivoBajoUnDescendienteIndirectoEsCiclo() {
		// 1 -> 2 -> 3: poner 1 bajo 3 cerraría el ciclo.
		existe(objetivo(1, null));
		existe(objetivo(2, 1L));
		existe(objetivo(3, 2L));

		assertThatThrownBy(() -> service.actualizar(1L, request(3L)))
				.isInstanceOf(ObjetivoInvalidoException.class)
				.hasMessageContaining("Ciclo");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void moverBajoOtraRamaEsValido() {
		Objetivo dos = existe(objetivo(2, 1L));
		existe(objetivo(5, 4L));
		existe(objetivo(4, null));
		when(repository.saveAndFlush(dos)).thenReturn(dos);

		assertThat(service.actualizar(2L, request(5L)).padreId()).isEqualTo(5L);
	}

	// ---- Eliminar: el 409 distingue el motivo ----

	@Test
	void eliminarInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.eliminar(1L)).isInstanceOf(ObjetivoNoEncontradoException.class);
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarConSubobjetivosDa409() {
		existe(objetivo(1, null));
		when(repository.existsByPadreIdAndUsuarioId(1L, U)).thenReturn(true);

		assertThatThrownBy(() -> service.eliminar(1L))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessageContaining("subobjetivos");
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarConProyectosDa409() {
		existe(objetivo(1, null));
		when(repository.existsByPadreIdAndUsuarioId(1L, U)).thenReturn(false);
		when(proyectoService.existenProyectosDelObjetivo(1L)).thenReturn(true);

		assertThatThrownBy(() -> service.eliminar(1L))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessageContaining("proyectos");
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarConTareasDa409() {
		existe(objetivo(1, null));
		when(repository.existsByPadreIdAndUsuarioId(1L, U)).thenReturn(false);
		when(proyectoService.existenProyectosDelObjetivo(1L)).thenReturn(false);
		when(tareaService.existenTareasDelObjetivo(1L)).thenReturn(true);

		assertThatThrownBy(() -> service.eliminar(1L))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessageContaining("tareas");
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarConIdeasDa409() {
		existe(objetivo(1, null));
		when(repository.existsByPadreIdAndUsuarioId(1L, U)).thenReturn(false);
		when(proyectoService.existenProyectosDelObjetivo(1L)).thenReturn(false);
		when(tareaService.existenTareasDelObjetivo(1L)).thenReturn(false);
		when(ideaService.existenIdeasDelObjetivo(1L)).thenReturn(true);

		assertThatThrownBy(() -> service.eliminar(1L))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessageContaining("ideas");
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarUnObjetivoVacioLoBorra() {
		Objetivo o = existe(objetivo(1, null));
		when(repository.existsByPadreIdAndUsuarioId(1L, U)).thenReturn(false);
		when(proyectoService.existenProyectosDelObjetivo(1L)).thenReturn(false);
		when(tareaService.existenTareasDelObjetivo(1L)).thenReturn(false);
		when(ideaService.existenIdeasDelObjetivo(1L)).thenReturn(false);

		service.eliminar(1L);

		verify(repository).delete(o);
	}

	// ---- Tareas del objetivo ----

	@Test
	void listarTareasDelegaEnTareaService() {
		existe(objetivo(1, null));
		when(tareaService.listarPorObjetivo(1L)).thenReturn(List.of(tareaEn(1L)));

		assertThat(service.listarTareas(1L)).hasSize(1);
	}

	@Test
	void listarTareasDeUnObjetivoInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.listarTareas(1L)).isInstanceOf(ObjetivoNoEncontradoException.class);
		verifyNoInteractions(tareaService);
	}

	@Test
	void asignarTareaDelegaYDevuelveLaTarea() {
		existe(objetivo(1, null));
		when(tareaService.asignarObjetivo(5L, 1L)).thenReturn(tareaEn(1L));

		assertThat(service.asignarTarea(1L, 5L).objetivoId()).isEqualTo(1L);
	}

	@Test
	void asignarTareaAUnObjetivoInexistenteFallaSinTocarLaTarea() {
		noExiste(1);

		assertThatThrownBy(() -> service.asignarTarea(1L, 5L)).isInstanceOf(ObjetivoNoEncontradoException.class);
		verifyNoInteractions(tareaService);
	}

	@Test
	void desasignarQuitaElObjetivoDeLaTarea() {
		existe(objetivo(1, null));
		when(tareaService.obtener(5L)).thenReturn(tareaEn(1L));

		service.desasignarTarea(1L, 5L);

		verify(tareaService).asignarObjetivo(5L, null);
	}

	@Test
	void desasignarUnaTareaDeOtroObjetivoOSinObjetivoFalla() {
		existe(objetivo(1, null));
		when(tareaService.obtener(5L)).thenReturn(tareaEn(2L)).thenReturn(tareaEn(null));

		assertThatThrownBy(() -> service.desasignarTarea(1L, 5L))
				.isInstanceOf(ObjetivoInvalidoException.class)
				.hasMessageContaining("no pertenece");
		assertThatThrownBy(() -> service.desasignarTarea(1L, 5L)).isInstanceOf(ObjetivoInvalidoException.class);
		verify(tareaService, never()).asignarObjetivo(any(), any());
	}

	@Test
	void desasignarDeUnObjetivoInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.desasignarTarea(1L, 5L)).isInstanceOf(ObjetivoNoEncontradoException.class);
		verifyNoInteractions(tareaService);
	}
}
