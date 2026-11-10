package com.agoals.proyecto;

import com.agoals.common.Estado;
import com.agoals.common.ModoBorrado;
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
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
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

	private static final EleccionesBorradoProyecto NINGUNA = EleccionesBorradoProyecto.NINGUNA;

	private static EleccionesBorradoProyecto elige(ModoBorrado subproyectos, ModoBorrado tareas, ModoBorrado ideas) {
		return new EleccionesBorradoProyecto(subproyectos, tareas, ideas);
	}

	private void hijosDe(long padreId, Proyecto... hijos) {
		when(repository.findByPadreIdAndUsuarioId(padreId, U)).thenReturn(List.of(hijos));
	}

	private static Proyecto llamado(Proyecto p, String nombre) {
		p.setNombre(nombre);
		return p;
	}

	@Test
	void eliminarInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.eliminar(1L, NINGUNA)).isInstanceOf(ProyectoNoEncontradoException.class);
		verify(repository, never()).delete(any());
		verifyNoInteractions(tareaService, ideaService);
	}

	@Test
	void eliminarInexistenteDa404ConCualquierEleccion() {
		noExiste(1);

		assertThatThrownBy(() -> service.eliminar(1L, elige(ModoBorrado.BORRAR, ModoBorrado.BORRAR, ModoBorrado.BORRAR)))
				.isInstanceOf(ProyectoNoEncontradoException.class);
		verify(repository, never()).findByPadreIdAndUsuarioId(any(), any());
	}

	@Test
	void eliminarConSubproyectosSinEleccionDa409ConElNombreYNoTocaNada() {
		existe(llamado(proyecto(1, null), "Casa"));
		hijosDe(1, proyecto(2, 1L));

		assertThatThrownBy(() -> service.eliminar(1L, NINGUNA))
				.isInstanceOf(ProyectoConDependenciasException.class)
				.hasMessage("El proyecto «Casa» tiene subproyectos: indica si quieres borrarlos o conservarlos");
		verify(repository, never()).delete(any());
		verify(repository, never()).deleteAll(anyIterable());
		verify(repository, never()).saveAllAndFlush(anyIterable());
		verifyNoInteractions(tareaService, ideaService);
	}

	@Test
	void eliminarConTareasSinEleccionDa409ConElNombreYNoEscribeNada() {
		existe(llamado(proyecto(1, null), "Casa"));
		hijosDe(1);
		when(tareaService.idsLigadas(List.of(1L), List.of())).thenReturn(List.of(5L));

		assertThatThrownBy(() -> service.eliminar(1L, NINGUNA))
				.isInstanceOf(ProyectoConDependenciasException.class)
				.hasMessage("El proyecto «Casa» tiene tareas: indica si quieres borrarlas o conservarlas");
		verify(repository, never()).delete(any());
		verify(tareaService, never()).desligar(any(), any(), any());
		verify(tareaService, never()).eliminarLigadas(any());
		verifyNoInteractions(ideaService);
	}

	@Test
	void eliminarConIdeasSinEleccionDa409ConElNombreYNoEscribeNada() {
		existe(llamado(proyecto(1, null), "Casa"));
		hijosDe(1);
		when(ideaService.idsLigadas(List.of(1L), List.of())).thenReturn(List.of(8L));

		assertThatThrownBy(() -> service.eliminar(1L, NINGUNA))
				.isInstanceOf(ProyectoConDependenciasException.class)
				.hasMessage("El proyecto «Casa» tiene ideas: indica si quieres borrarlas o conservarlas");
		verify(repository, never()).delete(any());
		verify(ideaService, never()).desligar(any(), any(), any());
		verify(ideaService, never()).eliminarLigadas(any());
	}

	@Test
	void eliminarConUnaCategoriaSinEleccionDa409AunqueLasDemasEstenElegidas() {
		existe(llamado(proyecto(1, null), "Casa"));
		hijosDe(1);
		when(tareaService.idsLigadas(List.of(1L), List.of())).thenReturn(List.of(5L));

		// Elige subproyectos e ideas, pero falta tareas.
		assertThatThrownBy(() -> service.eliminar(1L, elige(ModoBorrado.BORRAR, null, ModoBorrado.BORRAR)))
				.isInstanceOf(ProyectoConDependenciasException.class)
				.hasMessageContaining("tiene tareas");
		verify(ideaService, never()).eliminarLigadas(any());
		verify(repository, never()).deleteAll(anyIterable());
	}

	@Test
	void eliminarUnProyectoVacioLoBorraSinEleccionesNiConsultasInnecesarias() {
		Proyecto p = existe(proyecto(1, null));
		hijosDe(1);

		service.eliminar(1L, NINGUNA);

		verify(repository).delete(p);
		verify(repository, never()).saveAllAndFlush(anyIterable());
		verify(tareaService, never()).desligar(any(), any(), any());
		verify(tareaService, never()).eliminarLigadas(any());
		verify(ideaService, never()).desligar(any(), any(), any());
		verify(ideaService, never()).eliminarLigadas(any());
	}

	@Test
	void eliminarConEleccionesNulasEquivaleANinguna() {
		Proyecto p = existe(proyecto(1, null));
		hijosDe(1);

		service.eliminar(1L, null);

		verify(repository).delete(p);
	}

	@Test
	void eliminarIgnoraLaEleccionDeUnaCategoriaSinElementos() {
		Proyecto p = existe(proyecto(1, null));
		hijosDe(1);

		service.eliminar(1L, elige(ModoBorrado.BORRAR, ModoBorrado.BORRAR, ModoBorrado.CONSERVAR));

		verify(repository).deleteAll(List.of(p));
		verify(tareaService, never()).eliminarLigadas(any());
		verify(tareaService, never()).desligar(any(), any(), any());
		verify(ideaService, never()).desligar(any(), any(), any());
	}

	@Test
	void eliminarConservarSubproyectosConPadreSubeLosHijosAlAbueloYLuegoBorra() {
		Proyecto madre = existe(proyecto(2, 1L));
		Proyecto h1 = proyecto(3, 2L);
		Proyecto h2 = proyecto(4, 2L);
		hijosDe(2, h1, h2);

		service.eliminar(2L, elige(ModoBorrado.CONSERVAR, null, null));

		assertThat(h1.getPadreId()).isEqualTo(1L);
		assertThat(h2.getPadreId()).isEqualTo(1L);
		InOrder orden = inOrder(repository);
		orden.verify(repository).saveAllAndFlush(List.of(h1, h2));
		orden.verify(repository).delete(madre);
		orden.verify(repository).flush();
	}

	@Test
	void eliminarConservarSubproyectosSinPadreLosDejaRaiz() {
		Proyecto madre = existe(proyecto(1, null));
		Proyecto hija = proyecto(2, 1L);
		hijosDe(1, hija);

		service.eliminar(1L, elige(ModoBorrado.CONSERVAR, null, null));

		assertThat(hija.getPadreId()).isNull();
		verify(repository).delete(madre);
	}

	@Test
	void eliminarBorrarSubproyectosBorraTodoElSubarbolDeLasHojasALaRaiz() {
		Proyecto raiz = existe(proyecto(1, null));
		Proyecto h2 = proyecto(2, 1L);
		Proyecto h3 = proyecto(3, 1L);
		Proyecto n4 = proyecto(4, 2L);
		hijosDe(1, h2, h3);
		hijosDe(2, n4);
		hijosDe(3);
		hijosDe(4);

		service.eliminar(1L, elige(ModoBorrado.BORRAR, null, null));

		InOrder orden = inOrder(repository);
		orden.verify(repository).deleteAll(List.of(n4, h2, h3, raiz));
		orden.verify(repository).flush();
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarBorrarSubproyectosNoSeCuelgaConUnCiclo() {
		Proyecto raiz = existe(proyecto(1, null));
		Proyecto hija = proyecto(2, 1L);
		hijosDe(1, hija);
		hijosDe(2, raiz); // ciclo imposible por la API: solo red de seguridad

		service.eliminar(1L, elige(ModoBorrado.BORRAR, null, null));

		verify(repository).deleteAll(List.of(hija, raiz));
	}

	@Test
	void eliminarBorrarSubproyectosIncluyeElSubarbolEnElAlcanceDeTareasEIdeas() {
		Proyecto raiz = existe(proyecto(1, null));
		Proyecto hija = proyecto(2, 1L);
		hijosDe(1, hija);
		hijosDe(2);
		// Las tareas e ideas se buscan en TODOS los proyectos que se borran, hojas primero.
		when(tareaService.idsLigadas(List.of(2L, 1L), List.of())).thenReturn(List.of(5L));
		when(ideaService.idsLigadas(List.of(2L, 1L), List.of())).thenReturn(List.of(8L));

		service.eliminar(1L, elige(ModoBorrado.BORRAR, ModoBorrado.BORRAR, ModoBorrado.BORRAR));

		verify(tareaService).eliminarLigadas(List.of(5L));
		verify(ideaService).eliminarLigadas(List.of(8L));
		verify(repository).deleteAll(List.of(hija, raiz));
	}

	@Test
	void eliminarConservarSubproyectosSoloMiraLasTareasDelPropioProyecto() {
		existe(proyecto(1, null));
		hijosDe(1, proyecto(2, 1L));

		service.eliminar(1L, elige(ModoBorrado.CONSERVAR, null, null));

		verify(tareaService).idsLigadas(List.of(1L), List.of());
		verify(ideaService).idsLigadas(List.of(1L), List.of());
	}

	@Test
	void eliminarTareasConservarLasDesligaDelProyectoBorrado() {
		existe(proyecto(1, null));
		hijosDe(1);
		when(tareaService.idsLigadas(List.of(1L), List.of())).thenReturn(List.of(5L, 6L));

		service.eliminar(1L, elige(null, ModoBorrado.CONSERVAR, null));

		verify(tareaService).desligar(List.of(5L, 6L), List.of(1L), List.of());
		verify(tareaService, never()).eliminarLigadas(any());
	}

	@Test
	void eliminarIdeasConservarLasDejaLibres() {
		existe(proyecto(1, null));
		hijosDe(1);
		when(ideaService.idsLigadas(List.of(1L), List.of())).thenReturn(List.of(8L));

		service.eliminar(1L, elige(null, null, ModoBorrado.CONSERVAR));

		verify(ideaService).desligar(List.of(8L), List.of(1L), List.of());
		verify(ideaService, never()).eliminarLigadas(any());
	}

	@Test
	void eliminarEscribeEnOrdenTareasIdeasYAlFinalElProyecto() {
		Proyecto p = existe(proyecto(1, null));
		hijosDe(1);
		when(tareaService.idsLigadas(List.of(1L), List.of())).thenReturn(List.of(5L));
		when(ideaService.idsLigadas(List.of(1L), List.of())).thenReturn(List.of(8L));

		service.eliminar(1L, elige(null, ModoBorrado.BORRAR, ModoBorrado.CONSERVAR));

		// Si el proyecto se borrara antes, el SET NULL de la base soltaría tareas e ideas sin que las encontráramos.
		InOrder orden = inOrder(tareaService, ideaService, repository);
		orden.verify(tareaService).eliminarLigadas(List.of(5L));
		orden.verify(ideaService).desligar(List.of(8L), List.of(1L), List.of());
		orden.verify(repository).delete(p);
	}

	@Test
	void calcularAlcanceNoEscribeNadaYDescribeLoQueSeTocaria() {
		Proyecto raiz = existe(proyecto(1, null));
		Proyecto hija = proyecto(2, 1L);
		hijosDe(1, hija);
		hijosDe(2);
		when(tareaService.idsLigadas(List.of(2L, 1L), List.of())).thenReturn(List.of(5L));

		AlcanceBorradoProyecto alcance = service.calcularAlcance(1L, elige(ModoBorrado.BORRAR, ModoBorrado.BORRAR, null));

		assertThat(alcance.raiz()).isSameAs(raiz);
		assertThat(alcance.aBorrar()).containsExactly(hija, raiz);
		assertThat(alcance.tareaIds()).containsExactly(5L);
		assertThat(alcance.ideaIds()).isEmpty();
		verify(repository, never()).delete(any());
		verify(repository, never()).deleteAll(anyIterable());
		verify(repository, never()).saveAllAndFlush(anyIterable());
		verify(tareaService, never()).eliminarLigadas(any());
		verify(tareaService, never()).desligar(any(), any(), any());
	}

	// ---- Soporte para objetivo: borrar objetivos (5e) ----

	@Test
	void idsDeObjetivosDevuelveLosProyectosLigadosDirectamente() {
		when(repository.findByUsuarioIdAndObjetivoIdIn(U, List.of(3L))).thenReturn(List.of(proyecto(7, null), proyecto(8, null)));

		assertThat(service.idsDeObjetivos(List.of(3L))).containsExactly(7L, 8L);
	}

	@Test
	void idsDeObjetivosSinObjetivosNoConsultaNada() {
		assertThat(service.idsDeObjetivos(List.of())).isEmpty();

		verifyNoInteractions(repository);
	}

	private static Proyecto delObjetivo(long id, Long padreId, Long objetivoId) {
		Proyecto p = proyecto(id, padreId);
		p.setObjetivoId(objetivoId);
		return p;
	}

	@Test
	void planBorradoSinObjetivosEsVacio() {
		assertThat(service.planBorradoPorObjetivos(List.of())).isSameAs(PlanBorradoProyectos.VACIO);

		verifyNoInteractions(repository);
	}

	@Test
	void planBorradoIncluyeLosSubproyectosSinObjetivoOConUnObjetivoQueTambienSeBorra() {
		Proyecto raiz = delObjetivo(10, null, 3L);
		Proyecto sinObjetivo = delObjetivo(11, 10L, null);
		Proyecto delMismo = delObjetivo(12, 10L, 3L);
		when(repository.findByUsuarioIdAndObjetivoIdIn(U, List.of(3L))).thenReturn(List.of(raiz));
		hijosDe(10, sinObjetivo, delMismo);
		hijosDe(11);
		hijosDe(12);

		PlanBorradoProyectos plan = service.planBorradoPorObjetivos(List.of(3L));

		assertThat(plan.aBorrar()).containsExactly(11L, 12L, 10L);
		assertThat(plan.rescatados()).isEmpty();
	}

	@Test
	void planBorradoRescataUnSubproyectoLigadoAOtroObjetivoYNoBajaPorEl() {
		Proyecto raiz = delObjetivo(10, null, 3L);
		Proyecto rescatado = delObjetivo(11, 10L, 4L);
		when(repository.findByUsuarioIdAndObjetivoIdIn(U, List.of(3L))).thenReturn(List.of(raiz));
		hijosDe(10, rescatado);
		// Los hijos del rescatado no se consultan: su sub-árbol se salva entero.

		PlanBorradoProyectos plan = service.planBorradoPorObjetivos(List.of(3L));

		assertThat(plan.aBorrar()).containsExactly(10L);
		assertThat(plan.rescatados()).containsExactly(entry(11L, (Long) null));
		verify(repository, never()).findByPadreIdAndUsuarioId(eq(11L), any());
	}

	@Test
	void planBorradoRescataDosHermanosYCadaUnoQuedaConElMismoNuevoPadre() {
		Proyecto raiz = delObjetivo(10, null, 3L);
		Proyecto r1 = delObjetivo(11, 10L, 4L);
		Proyecto r2 = delObjetivo(12, 10L, 5L);
		when(repository.findByUsuarioIdAndObjetivoIdIn(U, List.of(3L))).thenReturn(List.of(raiz));
		hijosDe(10, r1, r2);

		PlanBorradoProyectos plan = service.planBorradoPorObjetivos(List.of(3L));

		assertThat(plan.aBorrar()).containsExactly(10L);
		assertThat(plan.rescatados()).containsOnlyKeys(11L, 12L);
		assertThat(plan.rescatados().get(11L)).isNull();
		assertThat(plan.rescatados().get(12L)).isNull();
	}

	@Test
	void planBorradoUnRescatadoVariosNivelesAbajoSubeAlAncestroQueSobrevive() {
		// 9 (no se borra) -> 10 (objetivo 3) -> 11 -> 12 -> 13 (objetivo 4, rescatado). Sube a 9, no a 12 ni a null.
		Proyecto raiz = delObjetivo(10, 9L, 3L);
		Proyecto s11 = delObjetivo(11, 10L, null);
		Proyecto s12 = delObjetivo(12, 11L, null);
		Proyecto rescatado = delObjetivo(13, 12L, 4L);
		when(repository.findByUsuarioIdAndObjetivoIdIn(U, List.of(3L))).thenReturn(List.of(raiz));
		hijosDe(10, s11);
		hijosDe(11, s12);
		hijosDe(12, rescatado);

		PlanBorradoProyectos plan = service.planBorradoPorObjetivos(List.of(3L));

		assertThat(plan.aBorrar()).containsExactly(12L, 11L, 10L);
		assertThat(plan.rescatados()).containsExactly(entry(13L, 9L));
	}

	@Test
	void planBorradoUnProyectoLigadoDirectoQueCuelgaDeUnRescatadoSeBorraYElRescatadoQueda() {
		// 10 (objetivo 3) -> 11 (objetivo 4, rescatado) -> 12 (objetivo 3, ligado directo) -> 13 (sin objetivo).
		Proyecto raiz = delObjetivo(10, null, 3L);
		Proyecto rescatado = delObjetivo(11, 10L, 4L);
		Proyecto ligado = delObjetivo(12, 11L, 3L);
		Proyecto hijoDelLigado = delObjetivo(13, 12L, null);
		when(repository.findByUsuarioIdAndObjetivoIdIn(U, List.of(3L))).thenReturn(List.of(raiz, ligado));
		hijosDe(10, rescatado);
		hijosDe(12, hijoDelLigado);
		hijosDe(13);

		PlanBorradoProyectos plan = service.planBorradoPorObjetivos(List.of(3L));

		assertThat(plan.aBorrar()).containsExactly(10L, 13L, 12L);
		assertThat(plan.rescatados()).containsExactly(entry(11L, (Long) null));
	}

	@Test
	void ejecutarBorradoPorObjetivosSinProyectosNoHaceNada() {
		service.ejecutarBorradoPorObjetivos(PlanBorradoProyectos.VACIO);

		verifyNoInteractions(repository);
	}

	@Test
	void ejecutarBorradoPorObjetivosReasignaLosRescatadosConFlushAntesDeBorrar() {
		Proyecto p10 = delObjetivo(10, null, 3L);
		Proyecto p12 = delObjetivo(12, 10L, null);
		Proyecto rescatado = delObjetivo(11, 10L, 4L);
		when(repository.findAllById(any())).thenReturn(List.of(p12, rescatado, p10)); // orden de la base: arbitrario
		Map<Long, Long> rescatados = new LinkedHashMap<>();
		rescatados.put(11L, 9L);

		service.ejecutarBorradoPorObjetivos(new PlanBorradoProyectos(List.of(12L, 10L), rescatados));

		assertThat(rescatado.getPadreId()).isEqualTo(9L);
		InOrder orden = inOrder(repository);
		orden.verify(repository).saveAllAndFlush(List.of(rescatado));
		orden.verify(repository).deleteAll(List.of(p12, p10)); // el orden del plan, no el de la base
		orden.verify(repository).flush();
	}

	@Test
	void desligarDeObjetivoPoneObjetivoNullYGuardaConFlush() {
		Proyecto a = delObjetivo(7, null, 3L);
		Proyecto b = delObjetivo(8, 7L, 3L);
		when(repository.findAllById(List.of(7L, 8L))).thenReturn(List.of(a, b));

		service.desligarDeObjetivo(List.of(7L, 8L));

		assertThat(a.getObjetivoId()).isNull();
		assertThat(b.getObjetivoId()).isNull();
		assertThat(b.getPadreId()).isEqualTo(7L);
		verify(repository).saveAllAndFlush(List.of(a, b));
	}

	@Test
	void desligarDeObjetivoSinProyectosNoHaceNada() {
		service.desligarDeObjetivo(List.of());

		verifyNoInteractions(repository);
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
