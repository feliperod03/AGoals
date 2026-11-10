package com.agoals.objetivo;

import com.agoals.common.ConteoBorrado;
import com.agoals.common.Estado;
import com.agoals.common.ModoBorrado;
import com.agoals.common.Prioridad;
import com.agoals.idea.IdeaService;
import com.agoals.objetivo.dto.ConteoProyectosBorrado;
import com.agoals.objetivo.dto.ImpactoBorradoObjetivoResponse;
import com.agoals.objetivo.dto.ObjetivoRequest;
import com.agoals.objetivo.dto.ObjetivoResponse;
import com.agoals.proyecto.PlanBorradoProyectos;
import com.agoals.proyecto.ProyectoService;
import com.agoals.tarea.TareaService;
import com.agoals.tarea.dto.TareaResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.inOrder;
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

	private static final EleccionesBorradoObjetivo NINGUNA = EleccionesBorradoObjetivo.NINGUNA;

	private static EleccionesBorradoObjetivo elige(ModoBorrado subobjetivos, ModoBorrado proyectos, ModoBorrado tareas,
			ModoBorrado ideas) {
		return new EleccionesBorradoObjetivo(subobjetivos, proyectos, tareas, ideas);
	}

	private void hijosDe(long padreId, Objetivo... hijos) {
		when(repository.findByPadreIdAndUsuarioId(padreId, U)).thenReturn(List.of(hijos));
	}

	private static Objetivo llamado(Objetivo o, String nombre) {
		o.setNombre(nombre);
		return o;
	}

	@Test
	void eliminarInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.eliminar(1L, NINGUNA)).isInstanceOf(ObjetivoNoEncontradoException.class);
		verify(repository, never()).delete(any());
		verifyNoInteractions(proyectoService, tareaService, ideaService);
	}

	@Test
	void eliminarInexistenteDa404ConCualquierEleccion() {
		noExiste(1);

		assertThatThrownBy(() -> service.eliminar(1L,
				elige(ModoBorrado.BORRAR, ModoBorrado.BORRAR, ModoBorrado.BORRAR, ModoBorrado.BORRAR)))
				.isInstanceOf(ObjetivoNoEncontradoException.class);
		verify(repository, never()).findByPadreIdAndUsuarioId(any(), any());
	}

	@Test
	void eliminarConSubobjetivosSinEleccionDa409ConElNombreYNoTocaNada() {
		existe(llamado(objetivo(1, null), "Salud"));
		hijosDe(1, objetivo(2, 1L));

		assertThatThrownBy(() -> service.eliminar(1L, NINGUNA))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessage("El objetivo «Salud» tiene subobjetivos: indica si quieres borrarlos o conservarlos");
		verify(repository, never()).delete(any());
		verify(repository, never()).deleteAll(anyIterable());
		verify(repository, never()).saveAllAndFlush(anyIterable());
		verifyNoInteractions(proyectoService, tareaService, ideaService);
	}

	@Test
	void eliminarConProyectosSinEleccionDa409ConElNombreYNoEscribeNada() {
		existe(llamado(objetivo(1, null), "Salud"));
		hijosDe(1);
		when(proyectoService.idsDeObjetivos(List.of(1L))).thenReturn(List.of(10L));

		assertThatThrownBy(() -> service.eliminar(1L, NINGUNA))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessage("El objetivo «Salud» tiene proyectos: indica si quieres borrarlos o conservarlos");
		verify(repository, never()).delete(any());
		verify(proyectoService, never()).planBorradoPorObjetivos(any());
		verify(proyectoService, never()).desligarDeObjetivo(any());
		verify(proyectoService, never()).ejecutarBorradoPorObjetivos(any());
		verifyNoInteractions(tareaService, ideaService);
	}

	@Test
	void eliminarConTareasSinEleccionDa409ConElNombreYNoEscribeNada() {
		existe(llamado(objetivo(1, null), "Salud"));
		hijosDe(1);
		when(tareaService.idsLigadas(List.of(), List.of(1L))).thenReturn(List.of(5L));

		assertThatThrownBy(() -> service.eliminar(1L, NINGUNA))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessage("El objetivo «Salud» tiene tareas: indica si quieres borrarlas o conservarlas");
		verify(repository, never()).delete(any());
		verify(tareaService, never()).desligar(any(), any(), any());
		verify(tareaService, never()).eliminarLigadas(any());
		verifyNoInteractions(ideaService);
	}

	@Test
	void eliminarConIdeasSinEleccionDa409ConElNombreYNoEscribeNada() {
		existe(llamado(objetivo(1, null), "Salud"));
		hijosDe(1);
		when(ideaService.idsLigadas(List.of(), List.of(1L))).thenReturn(List.of(8L));

		assertThatThrownBy(() -> service.eliminar(1L, NINGUNA))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessage("El objetivo «Salud» tiene ideas: indica si quieres borrarlas o conservarlas");
		verify(repository, never()).delete(any());
		verify(ideaService, never()).desligar(any(), any(), any());
		verify(ideaService, never()).eliminarLigadas(any());
	}

	@Test
	void eliminarConUnaCategoriaSinEleccionDa409AunqueLasDemasEstenElegidas() {
		existe(llamado(objetivo(1, null), "Salud"));
		hijosDe(1);
		when(proyectoService.idsDeObjetivos(List.of(1L))).thenReturn(List.of(10L));

		// Elige subobjetivos, tareas e ideas, pero falta proyectos.
		assertThatThrownBy(() -> service.eliminar(1L,
				elige(ModoBorrado.BORRAR, null, ModoBorrado.BORRAR, ModoBorrado.BORRAR)))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessageContaining("tiene proyectos");
		verify(repository, never()).deleteAll(anyIterable());
	}

	@Test
	void eliminarUnObjetivoVacioLoBorraSinTocarProyectosTareasNiIdeas() {
		Objetivo o = existe(objetivo(1, null));
		hijosDe(1);

		service.eliminar(1L, NINGUNA);

		verify(repository).delete(o);
		verify(repository, never()).saveAllAndFlush(anyIterable());
		verify(proyectoService, never()).desligarDeObjetivo(any());
		verify(proyectoService, never()).ejecutarBorradoPorObjetivos(any());
		verify(tareaService, never()).desligar(any(), any(), any());
		verify(tareaService, never()).eliminarLigadas(any());
		verify(ideaService, never()).desligar(any(), any(), any());
		verify(ideaService, never()).eliminarLigadas(any());
	}

	@Test
	void eliminarConEleccionesNulasEquivaleANinguna() {
		Objetivo o = existe(objetivo(1, null));
		hijosDe(1);

		service.eliminar(1L, null);

		verify(repository).delete(o);
	}

	@Test
	void eliminarIgnoraLaEleccionDeUnaCategoriaSinElementos() {
		Objetivo o = existe(objetivo(1, null));
		hijosDe(1);

		service.eliminar(1L, elige(ModoBorrado.BORRAR, ModoBorrado.BORRAR, ModoBorrado.BORRAR, ModoBorrado.CONSERVAR));

		verify(repository).deleteAll(List.of(o));
		verify(proyectoService, never()).planBorradoPorObjetivos(any());
		verify(tareaService, never()).eliminarLigadas(any());
		verify(ideaService, never()).desligar(any(), any(), any());
	}

	@Test
	void eliminarConservarSubobjetivosConPadreSubeLosHijosAlAbueloYLuegoBorra() {
		Objetivo madre = existe(objetivo(2, 1L));
		Objetivo h1 = objetivo(3, 2L);
		Objetivo h2 = objetivo(4, 2L);
		hijosDe(2, h1, h2);

		service.eliminar(2L, elige(ModoBorrado.CONSERVAR, null, null, null));

		assertThat(h1.getPadreId()).isEqualTo(1L);
		assertThat(h2.getPadreId()).isEqualTo(1L);
		InOrder orden = inOrder(repository);
		orden.verify(repository).saveAllAndFlush(List.of(h1, h2));
		orden.verify(repository).delete(madre);
		orden.verify(repository).flush();
	}

	@Test
	void eliminarConservarSubobjetivosSinPadreLosDejaRaiz() {
		Objetivo madre = existe(objetivo(1, null));
		Objetivo hija = objetivo(2, 1L);
		hijosDe(1, hija);

		service.eliminar(1L, elige(ModoBorrado.CONSERVAR, null, null, null));

		assertThat(hija.getPadreId()).isNull();
		verify(repository).delete(madre);
	}

	@Test
	void eliminarBorrarSubobjetivosBorraTodoElSubarbolDeLasHojasALaRaiz() {
		Objetivo raiz = existe(objetivo(1, null));
		Objetivo h2 = objetivo(2, 1L);
		Objetivo h3 = objetivo(3, 1L);
		Objetivo n4 = objetivo(4, 2L);
		hijosDe(1, h2, h3);
		hijosDe(2, n4);
		hijosDe(3);
		hijosDe(4);

		service.eliminar(1L, elige(ModoBorrado.BORRAR, null, null, null));

		InOrder orden = inOrder(repository);
		orden.verify(repository).deleteAll(List.of(n4, h2, h3, raiz));
		orden.verify(repository).flush();
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarBorrarSubobjetivosNoSeCuelgaConUnCiclo() {
		Objetivo raiz = existe(objetivo(1, null));
		Objetivo hija = objetivo(2, 1L);
		hijosDe(1, hija);
		hijosDe(2, raiz); // ciclo imposible por la API: solo red de seguridad

		service.eliminar(1L, elige(ModoBorrado.BORRAR, null, null, null));

		verify(repository).deleteAll(List.of(hija, raiz));
	}

	@Test
	void eliminarBorrarSubobjetivosIncluyeATodosLosObjetivosBorradosEnElAlcance() {
		existe(objetivo(1, null));
		Objetivo hija = objetivo(2, 1L);
		hijosDe(1, hija);
		hijosDe(2);

		service.eliminar(1L, elige(ModoBorrado.BORRAR, null, null, null));

		// Los proyectos, tareas e ideas se buscan en TODOS los objetivos que se borran, hojas primero.
		verify(proyectoService).idsDeObjetivos(List.of(2L, 1L));
		verify(tareaService).idsLigadas(List.of(), List.of(2L, 1L));
		verify(ideaService).idsLigadas(List.of(), List.of(2L, 1L));
	}

	@Test
	void eliminarProyectosBorrarUsaElPlanYAlcanzaSusTareasEIdeas() {
		Objetivo o = existe(objetivo(1, null));
		hijosDe(1);
		PlanBorradoProyectos plan = new PlanBorradoProyectos(List.of(12L, 10L), Map.of());
		when(proyectoService.idsDeObjetivos(List.of(1L))).thenReturn(List.of(10L));
		when(proyectoService.planBorradoPorObjetivos(List.of(1L))).thenReturn(plan);
		// Tareas e ideas de los proyectos que se borran y del objetivo, no solo del objetivo.
		when(tareaService.idsLigadas(List.of(12L, 10L), List.of(1L))).thenReturn(List.of(5L));
		when(ideaService.idsLigadas(List.of(12L, 10L), List.of(1L))).thenReturn(List.of(8L));

		service.eliminar(1L, elige(null, ModoBorrado.BORRAR, ModoBorrado.BORRAR, ModoBorrado.CONSERVAR));

		// Orden: de lo más dependiente a lo menos. Si el proyecto o el objetivo se borraran antes, el SET NULL
		// de la base soltaría tareas e ideas sin que las encontráramos.
		InOrder orden = inOrder(tareaService, ideaService, proyectoService, repository);
		orden.verify(tareaService).eliminarLigadas(List.of(5L));
		orden.verify(ideaService).desligar(List.of(8L), List.of(12L, 10L), List.of(1L));
		orden.verify(proyectoService).ejecutarBorradoPorObjetivos(plan);
		orden.verify(repository).delete(o);
		verify(proyectoService, never()).desligarDeObjetivo(any());
	}

	@Test
	void eliminarProyectosConservarLosDejaSinObjetivoYNoLosBorra() {
		Objetivo o = existe(objetivo(1, null));
		hijosDe(1);
		when(proyectoService.idsDeObjetivos(List.of(1L))).thenReturn(List.of(10L, 11L));

		service.eliminar(1L, elige(null, ModoBorrado.CONSERVAR, null, null));

		verify(proyectoService, never()).planBorradoPorObjetivos(any());
		verify(proyectoService, never()).ejecutarBorradoPorObjetivos(any());
		// Los proyectos conservados no cuentan en el alcance de tareas e ideas: solo las del objetivo.
		verify(tareaService).idsLigadas(List.of(), List.of(1L));
		InOrder orden = inOrder(proyectoService, repository);
		orden.verify(proyectoService).desligarDeObjetivo(List.of(10L, 11L));
		orden.verify(repository).delete(o);
	}

	@Test
	void eliminarTareasConservarDesligaSoloDeLosObjetivosYProyectosBorrados() {
		existe(objetivo(1, null));
		hijosDe(1);
		when(proyectoService.idsDeObjetivos(List.of(1L))).thenReturn(List.of(10L));
		when(proyectoService.planBorradoPorObjetivos(List.of(1L)))
				.thenReturn(new PlanBorradoProyectos(List.of(10L), Map.of()));
		when(tareaService.idsLigadas(List.of(10L), List.of(1L))).thenReturn(List.of(5L, 6L));

		service.eliminar(1L, elige(null, ModoBorrado.BORRAR, ModoBorrado.CONSERVAR, null));

		verify(tareaService).desligar(List.of(5L, 6L), List.of(10L), List.of(1L));
		verify(tareaService, never()).eliminarLigadas(any());
	}

	@Test
	void eliminarProyectosBorrarSinProyectosLigadosNoPideElPlan() {
		existe(objetivo(1, null));
		hijosDe(1);

		service.eliminar(1L, elige(null, ModoBorrado.BORRAR, null, null));

		verify(proyectoService, never()).planBorradoPorObjetivos(any());
		verify(proyectoService, never()).ejecutarBorradoPorObjetivos(any());
	}

	@Test
	void calcularAlcanceNoEscribeNadaYDescribeLoQueSeTocaria() {
		Objetivo raiz = existe(objetivo(1, null));
		Objetivo hija = objetivo(2, 1L);
		hijosDe(1, hija);
		hijosDe(2);
		PlanBorradoProyectos plan = new PlanBorradoProyectos(List.of(10L), Map.of(11L, 9L));
		when(proyectoService.idsDeObjetivos(List.of(2L, 1L))).thenReturn(List.of(10L));
		when(proyectoService.planBorradoPorObjetivos(List.of(2L, 1L))).thenReturn(plan);
		when(tareaService.idsLigadas(List.of(10L), List.of(2L, 1L))).thenReturn(List.of(5L));

		AlcanceBorradoObjetivo alcance = service.calcularAlcance(1L,
				elige(ModoBorrado.BORRAR, ModoBorrado.BORRAR, ModoBorrado.BORRAR, null));

		assertThat(alcance.raiz()).isSameAs(raiz);
		assertThat(alcance.objetivosABorrar()).containsExactly(hija, raiz);
		assertThat(alcance.proyectoIdsABorrar()).containsExactly(10L);
		assertThat(alcance.proyectoIdsRescatados()).containsExactly(11L);
		assertThat(alcance.tareaIds()).containsExactly(5L);
		assertThat(alcance.ideaIds()).isEmpty();
		verify(repository, never()).delete(any());
		verify(repository, never()).deleteAll(anyIterable());
		verify(repository, never()).saveAllAndFlush(anyIterable());
		verify(proyectoService, never()).ejecutarBorradoPorObjetivos(any());
		verify(proyectoService, never()).desligarDeObjetivo(any());
		verify(tareaService, never()).eliminarLigadas(any());
		verify(tareaService, never()).desligar(any(), any(), any());
	}

	// ---- Vista previa del impacto del borrado (5f) ----

	private void nadaSeEscribio() {
		verify(repository, never()).delete(any());
		verify(repository, never()).deleteAll(anyIterable());
		verify(repository, never()).saveAllAndFlush(anyIterable());
		verify(repository, never()).flush();
		verify(proyectoService, never()).ejecutarBorradoPorObjetivos(any());
		verify(proyectoService, never()).desligarDeObjetivo(any());
		verify(tareaService, never()).eliminarLigadas(any());
		verify(tareaService, never()).desligar(any(), any(), any());
		verify(ideaService, never()).eliminarLigadas(any());
		verify(ideaService, never()).desligar(any(), any(), any());
	}

	@Test
	void conservarLoNoElegidoCompletaSoloLasEleccionesAusentes() {
		assertThat(elige(ModoBorrado.BORRAR, null, null, ModoBorrado.BORRAR).conservarLoNoElegido())
				.isEqualTo(elige(ModoBorrado.BORRAR, ModoBorrado.CONSERVAR, ModoBorrado.CONSERVAR, ModoBorrado.BORRAR));
		assertThat(NINGUNA.conservarLoNoElegido()).isEqualTo(
				elige(ModoBorrado.CONSERVAR, ModoBorrado.CONSERVAR, ModoBorrado.CONSERVAR, ModoBorrado.CONSERVAR));
	}

	@Test
	void impactoBorradoInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.impactoBorrado(1L, NINGUNA))
				.isInstanceOf(ObjetivoNoEncontradoException.class)
				.hasMessage("No existe el objetivo con id 1");
		verifyNoInteractions(proyectoService, tareaService, ideaService);
	}

	@Test
	void impactoBorradoSinEleccionesNoDa409YDaLosTotalesConBorradosEnCero() {
		existe(objetivo(1, null));
		hijosDe(1, objetivo(2, 1L));
		when(proyectoService.idsDeObjetivos(List.of(1L))).thenReturn(List.of(10L, 11L));
		when(tareaService.idsLigadas(List.of(), List.of(1L))).thenReturn(List.of(5L, 6L, 7L));
		when(ideaService.idsLigadas(List.of(), List.of(1L))).thenReturn(List.of(8L));

		ImpactoBorradoObjetivoResponse r = service.impactoBorrado(1L, NINGUNA);

		assertThat(r.subobjetivos()).isEqualTo(new ConteoBorrado(1, 0));
		assertThat(r.proyectos()).isEqualTo(new ConteoProyectosBorrado(2, 0, 0));
		assertThat(r.tareas()).isEqualTo(new ConteoBorrado(3, 0));
		assertThat(r.ideas()).isEqualTo(new ConteoBorrado(1, 0));
		verify(proyectoService, never()).planBorradoPorObjetivos(any());
		verify(tareaService, never()).contarConSubtareas(any());
		nadaSeEscribio();
	}

	@Test
	void impactoBorradoEleccionesNullEquivalenAConservar() {
		existe(objetivo(1, null));
		hijosDe(1, objetivo(2, 1L));

		assertThat(service.impactoBorrado(1L, null).subobjetivos()).isEqualTo(new ConteoBorrado(1, 0));
	}

	@Test
	void impactoBorradoSubobjetivosBorrarCuentaElSubarbolSinLaRaizYAmpliaElAlcance() {
		existe(objetivo(1, null));
		hijosDe(1, objetivo(2, 1L), objetivo(3, 1L));
		hijosDe(2, objetivo(4, 2L));
		hijosDe(3);
		hijosDe(4);
		// Con el sub-árbol, los proyectos, tareas e ideas se buscan en los 4 objetivos.
		when(proyectoService.idsDeObjetivos(List.of(4L, 2L, 3L, 1L))).thenReturn(List.of(10L));

		ImpactoBorradoObjetivoResponse r = service.impactoBorrado(1L, elige(ModoBorrado.BORRAR, null, null, null));

		assertThat(r.subobjetivos()).isEqualTo(new ConteoBorrado(2, 3));
		assertThat(r.proyectos().total()).isEqualTo(1);
		nadaSeEscribio();
	}

	@Test
	void impactoBorradoSubobjetivosConservarSoloMiraElPropioObjetivo() {
		existe(objetivo(1, null));
		hijosDe(1, objetivo(2, 1L));

		ImpactoBorradoObjetivoResponse r = service.impactoBorrado(1L, elige(ModoBorrado.CONSERVAR, null, null, null));

		assertThat(r.subobjetivos()).isEqualTo(new ConteoBorrado(1, 0));
		verify(proyectoService).idsDeObjetivos(List.of(1L));
	}

	@Test
	void impactoBorradoProyectosBorrarCuentaLosDelPlanYLosRescatados() {
		existe(objetivo(1, null));
		hijosDe(1);
		when(proyectoService.idsDeObjetivos(List.of(1L))).thenReturn(List.of(10L));
		// P(10) ligado, SP(12) su subproyecto sin objetivo; R(11) se rescata y sube al abuelo (null).
		when(proyectoService.planBorradoPorObjetivos(List.of(1L)))
				.thenReturn(new PlanBorradoProyectos(List.of(12L, 10L), Map.of(11L, 9L)));

		ImpactoBorradoObjetivoResponse r = service.impactoBorrado(1L, elige(null, ModoBorrado.BORRAR, null, null));

		// total = ligados directos (1); borrados > total por el subproyecto arrastrado; rescatados aparte.
		assertThat(r.proyectos()).isEqualTo(new ConteoProyectosBorrado(1, 2, 1));
		nadaSeEscribio();
	}

	@Test
	void impactoBorradoProyectosConservarNoPideElPlanNiCuentaBorrados() {
		existe(objetivo(1, null));
		hijosDe(1);
		when(proyectoService.idsDeObjetivos(List.of(1L))).thenReturn(List.of(10L, 11L));

		ImpactoBorradoObjetivoResponse r = service.impactoBorrado(1L, elige(null, ModoBorrado.CONSERVAR, null, null));

		assertThat(r.proyectos()).isEqualTo(new ConteoProyectosBorrado(2, 0, 0));
		verify(proyectoService, never()).planBorradoPorObjetivos(any());
	}

	@Test
	void impactoBorradoTareasEIdeasSeBuscanEnLosProyectosQueSeBorranYSeCuentanConSusSubtareas() {
		existe(objetivo(1, null));
		hijosDe(1);
		when(proyectoService.idsDeObjetivos(List.of(1L))).thenReturn(List.of(10L));
		when(proyectoService.planBorradoPorObjetivos(List.of(1L)))
				.thenReturn(new PlanBorradoProyectos(List.of(10L), Map.of()));
		when(tareaService.idsLigadas(List.of(10L), List.of(1L))).thenReturn(List.of(5L, 6L));
		when(tareaService.contarConSubtareas(List.of(5L, 6L))).thenReturn(4);
		when(ideaService.idsLigadas(List.of(10L), List.of(1L))).thenReturn(List.of(8L, 9L));

		ImpactoBorradoObjetivoResponse r = service.impactoBorrado(1L,
				elige(null, ModoBorrado.BORRAR, ModoBorrado.BORRAR, ModoBorrado.BORRAR));

		assertThat(r.tareas()).isEqualTo(new ConteoBorrado(2, 4));
		assertThat(r.ideas()).isEqualTo(new ConteoBorrado(2, 2));
		nadaSeEscribio();
	}

	@Test
	void impactoBorradoTareasEIdeasConservarNoCuentanBorrados() {
		existe(objetivo(1, null));
		hijosDe(1);
		when(tareaService.idsLigadas(List.of(), List.of(1L))).thenReturn(List.of(5L));
		when(ideaService.idsLigadas(List.of(), List.of(1L))).thenReturn(List.of(8L));

		ImpactoBorradoObjetivoResponse r = service.impactoBorrado(1L,
				elige(null, null, ModoBorrado.CONSERVAR, ModoBorrado.CONSERVAR));

		assertThat(r.tareas()).isEqualTo(new ConteoBorrado(1, 0));
		assertThat(r.ideas()).isEqualTo(new ConteoBorrado(1, 0));
		verify(tareaService, never()).contarConSubtareas(any());
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
