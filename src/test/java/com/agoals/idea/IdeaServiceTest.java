package com.agoals.idea;

import com.agoals.idea.dto.ConcluirRequest;
import com.agoals.idea.dto.IdeaRequest;
import com.agoals.idea.dto.IdeaResponse;
import com.agoals.objetivo.ObjetivoConsultaService;
import com.agoals.objetivo.ObjetivoInvalidoException;
import com.agoals.proyecto.ProyectoConsultaService;
import com.agoals.proyecto.ProyectoInvalidoException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
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
class IdeaServiceTest {

	private static final Long U = IdeaService.USUARIO_ID;

	@Mock
	IdeaRepository repository;

	@Mock
	ProyectoConsultaService proyectoConsultaService;

	@Mock
	ObjetivoConsultaService objetivoConsultaService;

	@InjectMocks
	IdeaService service;

	private static IdeaRequest request(Long proyectoId, Long objetivoId) {
		return new IdeaRequest("Una idea", "detalle", proyectoId, objetivoId, null);
	}

	private static Idea idea(long id) {
		Idea i = new Idea();
		ReflectionTestUtils.setField(i, "id", id);
		i.setUsuarioId(U);
		i.setTitulo("i" + id);
		return i;
	}

	private Idea existe(Idea i) {
		when(repository.findByIdAndUsuarioId(i.getId(), U)).thenReturn(Optional.of(i));
		return i;
	}

	private void noExiste(long id) {
		when(repository.findByIdAndUsuarioId(id, U)).thenReturn(Optional.empty());
	}

	private Idea guardada() {
		ArgumentCaptor<Idea> captor = ArgumentCaptor.forClass(Idea.class);
		verify(repository).saveAndFlush(captor.capture());
		return captor.getValue();
	}

	// ---- Crear ----

	@Test
	void crearNacePlanteadaConLosDatosDelRequest() {
		when(repository.saveAndFlush(any(Idea.class))).thenAnswer(inv -> inv.getArgument(0));

		IdeaResponse r = service.crear(new IdeaRequest("Una idea", "detalle", null, null, "pensándolo"));

		Idea i = guardada();
		assertThat(i.getUsuarioId()).isEqualTo(U);
		assertThat(i.getTitulo()).isEqualTo("Una idea");
		assertThat(i.getDescripcion()).isEqualTo("detalle");
		assertThat(i.getEstado()).isEqualTo(EstadoIdea.PLANTEADA);
		assertThat(i.getConclusion()).isEqualTo("pensándolo");
		assertThat(i.getFechaCierre()).isNull();
		assertThat(r.estado()).isEqualTo(EstadoIdea.PLANTEADA);
	}

	@Test
	void crearGuardaDescripcionNulaComoCadenaVacia() {
		when(repository.saveAndFlush(any(Idea.class))).thenAnswer(inv -> inv.getArgument(0));

		service.crear(new IdeaRequest("Una idea", null, null, null, null));

		assertThat(guardada().getDescripcion()).isEmpty();
	}

	@Test
	void crearGuardaConclusionVaciaComoNula() {
		when(repository.saveAndFlush(any(Idea.class))).thenAnswer(inv -> inv.getArgument(0));

		service.crear(new IdeaRequest("Una idea", null, null, null, "   "));

		assertThat(guardada().getConclusion()).isNull();
	}

	@Test
	void crearLigadaAUnProyectoValidaQueExista() {
		when(repository.saveAndFlush(any(Idea.class))).thenAnswer(inv -> inv.getArgument(0));

		service.crear(request(4L, null));

		verify(proyectoConsultaService).validarExiste(4L);
		verifyNoInteractions(objetivoConsultaService);
		assertThat(guardada().getProyectoId()).isEqualTo(4L);
	}

	@Test
	void crearLigadaAUnObjetivoValidaQueExista() {
		when(repository.saveAndFlush(any(Idea.class))).thenAnswer(inv -> inv.getArgument(0));

		service.crear(request(null, 6L));

		verify(objetivoConsultaService).validarExiste(6L);
		verifyNoInteractions(proyectoConsultaService);
		assertThat(guardada().getObjetivoId()).isEqualTo(6L);
	}

	@Test
	void crearConProyectoYObjetivoADaVezDa400() {
		assertThatThrownBy(() -> service.crear(request(4L, 6L)))
				.isInstanceOf(IdeaInvalidaException.class)
				.hasMessageContaining("a la vez");
		verify(repository, never()).saveAndFlush(any());
		verifyNoInteractions(proyectoConsultaService, objetivoConsultaService);
	}

	@Test
	void crearConProyectoInexistenteDa400ConElMensajeDeProyecto() {
		doThrow(new ProyectoInvalidoException("El proyecto no existe: 99"))
				.when(proyectoConsultaService).validarExiste(99L);

		assertThatThrownBy(() -> service.crear(request(99L, null)))
				.isInstanceOf(ProyectoInvalidoException.class)
				.hasMessage("El proyecto no existe: 99");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void crearConObjetivoInexistenteDa400ConElMensajeDeObjetivo() {
		doThrow(new ObjetivoInvalidoException("El objetivo no existe: 99"))
				.when(objetivoConsultaService).validarExiste(99L);

		assertThatThrownBy(() -> service.crear(request(null, 99L)))
				.isInstanceOf(ObjetivoInvalidoException.class)
				.hasMessage("El objetivo no existe: 99");
		verify(repository, never()).saveAndFlush(any());
	}

	// ---- Obtener / listar ----

	@Test
	void obtenerInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.obtener(1L)).isInstanceOf(IdeaNoEncontradaException.class);
	}

	@Test
	void listarPasaLosFiltrosAlRepository() {
		when(repository.listar(U, EstadoIdea.CONCLUIDA, 4L, null, false)).thenReturn(List.of(idea(1)));

		assertThat(service.listar(EstadoIdea.CONCLUIDA, 4L, null, null)).hasSize(1);
	}

	@Test
	void listarLibresTrueFiltraSoloLasLibres() {
		when(repository.listar(U, null, null, null, true)).thenReturn(List.of(idea(1)));

		assertThat(service.listar(null, null, null, true)).hasSize(1);
	}

	@Test
	void listarLibresFalseEquivaleANoFiltrar() {
		when(repository.listar(U, null, null, null, false)).thenReturn(List.of());

		assertThat(service.listar(null, null, null, false)).isEmpty();
		verify(repository).listar(U, null, null, null, false);
	}

	@Test
	void listarLibresConProyectoIdDa400() {
		assertThatThrownBy(() -> service.listar(null, 4L, null, true))
				.isInstanceOf(IdeaInvalidaException.class)
				.hasMessageContaining("libres");
		verifyNoInteractions(repository);
	}

	@Test
	void listarLibresConObjetivoIdDa400() {
		assertThatThrownBy(() -> service.listar(null, null, 6L, true))
				.isInstanceOf(IdeaInvalidaException.class);
		verifyNoInteractions(repository);
	}

	// ---- Actualizar ----

	@Test
	void actualizarCambiaLosDatosPeroNoElEstado() {
		Idea i = existe(idea(1));
		i.setEstado(EstadoIdea.CONCLUIDA);
		OffsetDateTime cierre = OffsetDateTime.now().minusDays(1);
		i.setFechaCierre(cierre);
		i.setConclusion("vieja");
		when(repository.saveAndFlush(i)).thenReturn(i);

		service.actualizar(1L, new IdeaRequest("Nuevo título", "otra", null, 6L, "nueva"));

		assertThat(i.getTitulo()).isEqualTo("Nuevo título");
		assertThat(i.getDescripcion()).isEqualTo("otra");
		assertThat(i.getObjetivoId()).isEqualTo(6L);
		assertThat(i.getConclusion()).isEqualTo("nueva");
		assertThat(i.getEstado()).isEqualTo(EstadoIdea.CONCLUIDA);
		assertThat(i.getFechaCierre()).isEqualTo(cierre);
		verify(objetivoConsultaService).validarExiste(6L);
	}

	@Test
	void actualizarSinConclusionLaDejaNula() {
		Idea i = existe(idea(1));
		i.setConclusion("vieja");
		when(repository.saveAndFlush(i)).thenReturn(i);

		service.actualizar(1L, new IdeaRequest("t", null, null, null, null));

		assertThat(i.getConclusion()).isNull();
		assertThat(i.getDescripcion()).isEmpty();
	}

	@Test
	void actualizarPuedeSoltarElVinculo() {
		Idea i = existe(idea(1));
		i.setProyectoId(4L);
		when(repository.saveAndFlush(i)).thenReturn(i);

		service.actualizar(1L, request(null, null));

		assertThat(i.getProyectoId()).isNull();
		assertThat(i.getObjetivoId()).isNull();
	}

	@Test
	void actualizarInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.actualizar(1L, request(null, null)))
				.isInstanceOf(IdeaNoEncontradaException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void actualizarConProyectoYObjetivoADaVezDa400() {
		existe(idea(1));

		assertThatThrownBy(() -> service.actualizar(1L, request(4L, 6L)))
				.isInstanceOf(IdeaInvalidaException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void actualizarConProyectoInexistenteDa400() {
		existe(idea(1));
		doThrow(new ProyectoInvalidoException("El proyecto no existe: 99"))
				.when(proyectoConsultaService).validarExiste(99L);

		assertThatThrownBy(() -> service.actualizar(1L, request(99L, null)))
				.isInstanceOf(ProyectoInvalidoException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	// ---- Eliminar ----

	@Test
	void eliminarInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.eliminar(1L)).isInstanceOf(IdeaNoEncontradaException.class);
		verify(repository, never()).delete(any());
	}

	@Test
	void eliminarBorraLaIdea() {
		Idea i = existe(idea(1));

		service.eliminar(1L);

		verify(repository).delete(i);
	}

	// ---- Concluir ----

	@Test
	void concluirPasaAConcluidaConFechaDeCierreAhora() {
		Idea i = existe(idea(1));
		when(repository.saveAndFlush(i)).thenReturn(i);
		OffsetDateTime antes = OffsetDateTime.now();

		IdeaResponse r = service.concluir(1L, new ConcluirRequest("Salió bien"));

		OffsetDateTime despues = OffsetDateTime.now();
		assertThat(i.getEstado()).isEqualTo(EstadoIdea.CONCLUIDA);
		assertThat(i.getConclusion()).isEqualTo("Salió bien");
		assertThat(i.getFechaCierre()).isBetween(antes, despues);
		assertThat(r.estado()).isEqualTo(EstadoIdea.CONCLUIDA);
		assertThat(r.fechaCierre()).isEqualTo(i.getFechaCierre());
	}

	@Test
	void concluirConConclusionNoVaciaReemplazaLaExistente() {
		Idea i = existe(idea(1));
		i.setConclusion("anterior");
		when(repository.saveAndFlush(i)).thenReturn(i);

		service.concluir(1L, new ConcluirRequest("nueva"));

		assertThat(i.getConclusion()).isEqualTo("nueva");
	}

	@Test
	void concluirSinCuerpoConservaLaConclusionAnterior() {
		Idea i = existe(idea(1));
		i.setConclusion("anterior");
		when(repository.saveAndFlush(i)).thenReturn(i);

		service.concluir(1L, null);

		assertThat(i.getEstado()).isEqualTo(EstadoIdea.CONCLUIDA);
		assertThat(i.getConclusion()).isEqualTo("anterior");
		assertThat(i.getFechaCierre()).isNotNull();
	}

	@Test
	void concluirConConclusionNulaOVaciaConservaLaAnterior() {
		Idea i = existe(idea(1));
		i.setConclusion("anterior");
		when(repository.saveAndFlush(i)).thenReturn(i);

		service.concluir(1L, new ConcluirRequest("  "));

		assertThat(i.getConclusion()).isEqualTo("anterior");
	}

	@Test
	void concluirSinConclusionPreviaNiNuevaLaDejaNula() {
		Idea i = existe(idea(1));
		when(repository.saveAndFlush(i)).thenReturn(i);

		service.concluir(1L, new ConcluirRequest(null));

		assertThat(i.getConclusion()).isNull();
		assertThat(i.getEstado()).isEqualTo(EstadoIdea.CONCLUIDA);
	}

	@Test
	void concluirUnaIdeaYaConcluidaDa409() {
		Idea i = existe(idea(1));
		i.setEstado(EstadoIdea.CONCLUIDA);

		assertThatThrownBy(() -> service.concluir(1L, new ConcluirRequest("x")))
				.isInstanceOf(IdeaEstadoInvalidaException.class)
				.hasMessageContaining("ya está concluida");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void concluirInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.concluir(1L, null)).isInstanceOf(IdeaNoEncontradaException.class);
	}

	// ---- Reabrir ----

	@Test
	void reabrirVuelveAPlanteadaSinFechaDeCierreYConservaLaConclusion() {
		Idea i = existe(idea(1));
		i.setEstado(EstadoIdea.CONCLUIDA);
		i.setConclusion("la conclusión");
		i.setFechaCierre(OffsetDateTime.now());
		when(repository.saveAndFlush(i)).thenReturn(i);

		IdeaResponse r = service.reabrir(1L);

		assertThat(i.getEstado()).isEqualTo(EstadoIdea.PLANTEADA);
		assertThat(i.getFechaCierre()).isNull();
		assertThat(i.getConclusion()).isEqualTo("la conclusión");
		assertThat(r.estado()).isEqualTo(EstadoIdea.PLANTEADA);
		assertThat(r.fechaCierre()).isNull();
	}

	@Test
	void reabrirUnaIdeaYaPlanteadaNoCambiaNada() {
		Idea i = existe(idea(1));
		i.setConclusion("algo");

		IdeaResponse r = service.reabrir(1L);

		assertThat(r.estado()).isEqualTo(EstadoIdea.PLANTEADA);
		assertThat(r.conclusion()).isEqualTo("algo");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void reabrirInexistenteFalla() {
		noExiste(1);

		assertThatThrownBy(() -> service.reabrir(1L)).isInstanceOf(IdeaNoEncontradaException.class);
	}

	// ---- Soporte para proyecto y objetivo ----

	@Test
	void idsLigadasUneProyectosYObjetivosSinRepetir() {
		Idea a = idea(1);
		Idea b = idea(2);
		when(repository.findByUsuarioIdAndProyectoIdIn(U, List.of(3L))).thenReturn(List.of(a, b));
		when(repository.findByUsuarioIdAndObjetivoIdIn(U, List.of(5L))).thenReturn(List.of(b));

		assertThat(service.idsLigadas(List.of(3L), List.of(5L))).containsExactly(1L, 2L);
	}

	@Test
	void idsLigadasConColeccionesVaciasNoConsultaNada() {
		assertThat(service.idsLigadas(List.of(), List.of())).isEmpty();

		verifyNoInteractions(repository);
	}

	@Test
	void desligarPoneANullSoloLaColumnaQueApuntaAAlgoBorradoYGuardaConFlush() {
		Idea delProyecto = idea(1);
		delProyecto.setProyectoId(3L);
		Idea delObjetivo = idea(2);
		delObjetivo.setObjetivoId(5L);
		Idea deOtroProyecto = idea(3);
		deOtroProyecto.setProyectoId(99L);
		when(repository.findAllById(List.of(1L, 2L, 3L))).thenReturn(List.of(delProyecto, delObjetivo, deOtroProyecto));

		service.desligar(List.of(1L, 2L, 3L), List.of(3L), List.of(5L));

		assertThat(delProyecto.getProyectoId()).isNull();
		assertThat(delObjetivo.getObjetivoId()).isNull();
		assertThat(deOtroProyecto.getProyectoId()).isEqualTo(99L);
		verify(repository).saveAllAndFlush(List.of(delProyecto, delObjetivo, deOtroProyecto));
	}

	@Test
	void desligarYEliminarLigadasSinIdeasNoHacenNada() {
		service.desligar(List.of(), List.of(3L), List.of(5L));
		service.eliminarLigadas(List.of());

		verifyNoInteractions(repository);
	}

	@Test
	void eliminarLigadasBorraLasIdeasYHaceFlush() {
		Idea a = idea(1);
		Idea b = idea(2);
		when(repository.findAllById(List.of(1L, 2L))).thenReturn(List.of(a, b));

		service.eliminarLigadas(List.of(1L, 2L));

		verify(repository).deleteAll(List.of(a, b));
		verify(repository).flush();
	}
}

