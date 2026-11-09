package com.agoals.tarea;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;

import com.agoals.tarea.dto.AgendaResponse;
import com.agoals.tarea.dto.AgendarRequest;
import com.agoals.tarea.dto.PosponerRequest;
import com.agoals.tarea.dto.TareaRecomendadaResponse;
import com.agoals.tarea.dto.TareaRequest;
import com.agoals.tarea.dto.TareaResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TareaServiceTest {

	@Mock
	TareaRepository repository;

	@InjectMocks
	TareaService service;

	private static TareaRequest request(LocalDate fecha, LocalTime inicio, LocalTime fin, Long padreId) {
		return new TareaRequest("Comprar pan", "integral", null, Prioridad.ALTA, fecha, inicio, fin, padreId);
	}

	private static Tarea tarea(String titulo) {
		Tarea t = new Tarea();
		t.setUsuarioId(TareaService.USUARIO_ID);
		t.setTitulo(titulo);
		return t;
	}

	@Test
	void crearAplicaEstadoPorDefectoYUsuarioFijo() {
		when(repository.save(any(Tarea.class))).thenAnswer(inv -> inv.getArgument(0));

		TareaResponse r = service.crear(request(LocalDate.of(2026, 11, 5), null, null, null));

		ArgumentCaptor<Tarea> captor = ArgumentCaptor.forClass(Tarea.class);
		verify(repository).save(captor.capture());
		assertThat(captor.getValue().getUsuarioId()).isEqualTo(TareaService.USUARIO_ID);
		assertThat(r.estado()).isEqualTo(Estado.PENDIENTE);
		assertThat(r.titulo()).isEqualTo("Comprar pan");
		assertThat(r.prioridad()).isEqualTo(Prioridad.ALTA);
		assertThat(r.vecesPospuesta()).isZero();
	}

	@Test
	void crearConHoraInicioSinFechaFalla() {
		assertThatThrownBy(() -> service.crear(request(null, LocalTime.of(9, 0), null, null)))
				.isInstanceOf(TareaInvalidaException.class);
		verify(repository, never()).save(any());
	}

	@Test
	void crearConHoraFinSinHoraInicioFalla() {
		assertThatThrownBy(() -> service.crear(request(LocalDate.of(2026, 11, 5), null, LocalTime.of(10, 0), null)))
				.isInstanceOf(TareaInvalidaException.class);
	}

	@Test
	void crearConHoraFinNoPosteriorFalla() {
		assertThatThrownBy(() -> service.crear(
				request(LocalDate.of(2026, 11, 5), LocalTime.of(10, 0), LocalTime.of(10, 0), null)))
				.isInstanceOf(TareaInvalidaException.class);
	}

	@Test
	void crearConPadreInexistenteFalla() {
		when(repository.findByIdAndUsuarioId(99L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.crear(request(null, null, null, 99L)))
				.isInstanceOf(TareaInvalidaException.class);
	}

	@Test
	void crearConPadreExistenteGuardaElPadre() {
		when(repository.findByIdAndUsuarioId(5L, TareaService.USUARIO_ID)).thenReturn(Optional.of(tarea("padre")));
		when(repository.save(any(Tarea.class))).thenAnswer(inv -> inv.getArgument(0));

		TareaResponse r = service.crear(request(null, null, null, 5L));

		assertThat(r.padreId()).isEqualTo(5L);
	}

	@Test
	void obtenerExistenteDevuelveRespuesta() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.of(tarea("a")));

		assertThat(service.obtener(1L).titulo()).isEqualTo("a");
	}

	@Test
	void obtenerInexistenteFalla() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.obtener(1L)).isInstanceOf(TareaNoEncontradaException.class);
	}

	@Test
	void validarExisteNoHaceNadaSiLaTareaExiste() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.of(tarea("a")));

		service.validarExiste(1L);
	}

	@Test
	void validarExisteLanza400ConElMensajeDelEstiloDeLosOtrosModulos() {
		when(repository.findByIdAndUsuarioId(7L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.validarExiste(7L))
				.isInstanceOf(TareaInvalidaException.class)
				.hasMessage("La tarea no existe: 7");
	}

	@Test
	void listarDevuelveTodasMapeadas() {
		when(repository.findByUsuarioIdOrderByFechaAscIdAsc(TareaService.USUARIO_ID))
				.thenReturn(List.of(tarea("a"), tarea("b")));

		assertThat(service.listar()).extracting(TareaResponse::titulo).containsExactly("a", "b");
	}

	@Test
	void actualizarCambiaLosCampos() {
		Tarea existente = tarea("vieja");
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.of(existente));
		when(repository.save(existente)).thenReturn(existente);

		TareaResponse r = service.actualizar(1L, request(LocalDate.of(2026, 11, 6), null, null, null));

		assertThat(r.titulo()).isEqualTo("Comprar pan");
		assertThat(r.fecha()).isEqualTo(LocalDate.of(2026, 11, 6));
	}

	@Test
	void actualizarInexistenteFalla() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.actualizar(1L, request(null, null, null, null)))
				.isInstanceOf(TareaNoEncontradaException.class);
	}

	@Test
	void actualizarConSiMismaComoPadreFalla() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.of(tarea("a")));

		assertThatThrownBy(() -> service.actualizar(1L, request(null, null, null, 1L)))
				.isInstanceOf(TareaInvalidaException.class);
	}

	// ---- Eliminar ----

	private static Tarea conPadre(long id, String titulo, Long padreId) {
		Tarea t = tarea(titulo);
		ReflectionTestUtils.setField(t, "id", id);
		t.setPadreId(padreId);
		return t;
	}

	private void hijasDe(Tarea padre, Tarea... hijas) {
		when(repository.findByPadreIdAndUsuarioId(padre.getId(), TareaService.USUARIO_ID)).thenReturn(List.of(hijas));
	}

	@Test
	void eliminarSinSubtareasLaBorraConOSinModo() {
		Tarea hoja = conPadre(1, "hoja", null);
		existe(hoja);
		hijasDe(hoja);

		service.eliminar(1L, null);
		service.eliminar(1L, ModoSubtareas.BORRAR);
		service.eliminar(1L, ModoSubtareas.CONSERVAR);

		verify(repository, times(3)).delete(hoja);
	}

	@Test
	void eliminarConSubtareasSinModoDa409ConElTituloYNoBorra() {
		Tarea madre = conPadre(1, "Estudiar", null);
		existe(madre);
		hijasDe(madre, conPadre(2, "hija", 1L));

		assertThatThrownBy(() -> service.eliminar(1L, null))
				.isInstanceOf(TareaConDependenciasException.class)
				.hasMessage("«Estudiar» tiene subtareas: indica si quieres borrarlas o conservarlas");
		verify(repository, never()).delete(any());
		verify(repository, never()).deleteAll(anyIterable());
	}

	@Test
	void eliminarBorrarVariosNivelesBorraTodoDeLasHojasALaRaiz() {
		Tarea raiz = conPadre(1, "raiz", null);
		Tarea h1 = conPadre(2, "h1", 1L);
		Tarea h2 = conPadre(3, "h2", 1L);
		Tarea n1 = conPadre(4, "n1", 2L);
		Tarea b1 = conPadre(5, "b1", 4L);
		existe(raiz);
		hijasDe(raiz, h1, h2);
		hijasDe(h1, n1);
		hijasDe(h2);
		hijasDe(n1, b1);
		hijasDe(b1);

		service.eliminar(1L, ModoSubtareas.BORRAR);

		InOrder orden = inOrder(repository);
		orden.verify(repository).deleteAll(List.of(b1));
		orden.verify(repository).deleteAll(List.of(n1));
		orden.verify(repository).deleteAll(List.of(h1, h2));
		orden.verify(repository).delete(raiz);
		orden.verify(repository).flush();
	}

	@Test
	void eliminarBorrarNoSeCuelgaConUnCiclo() {
		Tarea raiz = conPadre(1, "raiz", null);
		Tarea hija = conPadre(2, "hija", 1L);
		existe(raiz);
		hijasDe(raiz, hija);
		hijasDe(hija, raiz); // ciclo imposible por la API: solo red de seguridad

		service.eliminar(1L, ModoSubtareas.BORRAR);

		verify(repository).deleteAll(List.of(hija));
		verify(repository).delete(raiz);
	}

	@Test
	void eliminarConservarConPadreSubeLasHijasAlAbueloYLuegoBorra() {
		Tarea madre = conPadre(2, "madre", 1L);
		Tarea h1 = conPadre(3, "h1", 2L);
		Tarea h2 = conPadre(4, "h2", 2L);
		h1.setEstado(Estado.EN_PROGRESO);
		h1.setFecha(DIA);
		existe(madre);
		hijasDe(madre, h1, h2);

		service.eliminar(2L, ModoSubtareas.CONSERVAR);

		assertThat(h1.getPadreId()).isEqualTo(1L);
		assertThat(h2.getPadreId()).isEqualTo(1L);
		assertThat(h1.getEstado()).isEqualTo(Estado.EN_PROGRESO);
		assertThat(h1.getFecha()).isEqualTo(DIA);
		InOrder orden = inOrder(repository);
		orden.verify(repository).saveAllAndFlush(List.of(h1, h2));
		orden.verify(repository).delete(madre);
	}

	@Test
	void eliminarConservarSinPadreDejaLasHijasSinMadre() {
		Tarea madre = conPadre(1, "madre", null);
		Tarea hija = conPadre(2, "hija", 1L);
		existe(madre);
		hijasDe(madre, hija);

		service.eliminar(1L, ModoSubtareas.CONSERVAR);

		assertThat(hija.getPadreId()).isNull();
		verify(repository).delete(madre);
	}

	@Test
	void eliminarInexistenteDa404ConCualquierModo() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		for (ModoSubtareas modo : new ModoSubtareas[] { null, ModoSubtareas.BORRAR, ModoSubtareas.CONSERVAR }) {
			assertThatThrownBy(() -> service.eliminar(1L, modo)).isInstanceOf(TareaNoEncontradaException.class);
		}
		verify(repository, never()).findByPadreIdAndUsuarioId(any(), any());
		verify(repository, never()).delete(any());
	}

	// ---- Agenda del día ----

	private static final LocalDate DIA = LocalDate.of(2026, 11, 6);

	private static Tarea agendada(long id, String titulo, LocalDate fecha, LocalTime inicio, Prioridad prioridad,
			Estado estado) {
		Tarea t = tarea(titulo);
		ReflectionTestUtils.setField(t, "id", id);
		t.setFecha(fecha);
		t.setHoraInicio(inicio);
		t.setPrioridad(prioridad);
		t.setEstado(estado);
		return t;
	}

	private void existe(Tarea t) {
		when(repository.findByIdAndUsuarioId(t.getId(), TareaService.USUARIO_ID)).thenReturn(Optional.of(t));
	}

	@Test
	void agendaSeparaConHoraDeSueltasYOrdenaCadaGrupo() {
		when(repository.findByUsuarioIdAndFechaOrderByHoraInicioAscIdAsc(TareaService.USUARIO_ID, DIA)).thenReturn(List.of(
				agendada(1, "hora 9", DIA, LocalTime.of(9, 0), null, Estado.PENDIENTE),
				agendada(2, "hora 15", DIA, LocalTime.of(15, 0), null, Estado.PENDIENTE),
				agendada(3, "sin prioridad", DIA, null, null, Estado.PENDIENTE),
				agendada(4, "baja", DIA, null, Prioridad.BAJA, Estado.PENDIENTE),
				agendada(5, "alta b", DIA, null, Prioridad.ALTA, Estado.PENDIENTE),
				agendada(6, "media", DIA, null, Prioridad.MEDIA, Estado.PENDIENTE),
				agendada(7, "alta a", DIA, null, Prioridad.ALTA, Estado.PENDIENTE)));

		AgendaResponse agenda = service.agendaDelDia(DIA);

		assertThat(agenda.fecha()).isEqualTo(DIA);
		assertThat(agenda.conHora()).extracting(TareaResponse::titulo).containsExactly("hora 9", "hora 15");
		// ALTA primero (desempata por id), luego MEDIA, BAJA y, al final, sin prioridad.
		assertThat(agenda.sinHora()).extracting(TareaResponse::titulo)
				.containsExactly("alta b", "alta a", "media", "baja", "sin prioridad");
	}

	@Test
	void agendaDeDiaVacioDevuelveListasVacias() {
		when(repository.findByUsuarioIdAndFechaOrderByHoraInicioAscIdAsc(TareaService.USUARIO_ID, DIA))
				.thenReturn(List.of());

		AgendaResponse agenda = service.agendaDelDia(DIA);

		assertThat(agenda.conHora()).isEmpty();
		assertThat(agenda.sinHora()).isEmpty();
	}

	// ---- Marcar como hecha ----

	@Test
	void marcarHechaCambiaElEstado() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.EN_PROGRESO);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		assertThat(service.marcarHecha(1L).estado()).isEqualTo(Estado.HECHO);
	}

	@Test
	void marcarHechaUnaTareaYaHechaEsIdempotente() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.HECHO);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		assertThat(service.marcarHecha(1L).estado()).isEqualTo(Estado.HECHO);
	}

	@Test
	void marcarHechaInexistenteFalla() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.marcarHecha(1L)).isInstanceOf(TareaNoEncontradaException.class);
		verify(repository, never()).save(any());
	}

	@Test
	void marcarHechaUnaTareaCanceladaFalla() {
		existe(agendada(1, "a", DIA, null, null, Estado.CANCELADO));

		assertThatThrownBy(() -> service.marcarHecha(1L)).isInstanceOf(TareaEstadoInvalidaException.class);
		verify(repository, never()).save(any());
	}

	// ---- Posponer ----

	@Test
	void posponerSinBodySumaUnDiaYCuentaElAplazamiento() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.PENDIENTE);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		TareaResponse r = service.posponer(1L, null);

		assertThat(r.fecha()).isEqualTo(DIA.plusDays(1));
		assertThat(r.vecesPospuesta()).isEqualTo(1);
	}

	@Test
	void posponerSinFechaEnElBodyTambienSumaUnDia() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.PENDIENTE);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		assertThat(service.posponer(1L, new PosponerRequest(null)).fecha()).isEqualTo(DIA.plusDays(1));
	}

	// Decisión documentada: el "día siguiente" es relativo a la fecha de la tarea, no a hoy.
	@Test
	void posponerSinBodySumaUnDiaALaFechaDeLaTareaAunqueQuedeEnElPasado() {
		LocalDate muyVieja = LocalDate.of(2020, 1, 1);
		Tarea t = agendada(1, "atrasada", muyVieja, null, null, Estado.PENDIENTE);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		assertThat(service.posponer(1L, null).fecha()).isEqualTo(LocalDate.of(2020, 1, 2));
	}

	@Test
	void posponerAUnaFechaExplicitaYConservaLasHoras() {
		Tarea t = agendada(1, "a", DIA, LocalTime.of(9, 0), null, Estado.PENDIENTE);
		t.setHoraFin(LocalTime.of(10, 0));
		existe(t);
		when(repository.save(t)).thenReturn(t);

		TareaResponse r = service.posponer(1L, new PosponerRequest(DIA.plusDays(5)));

		assertThat(r.fecha()).isEqualTo(DIA.plusDays(5));
		assertThat(r.horaInicio()).isEqualTo(LocalTime.of(9, 0));
		assertThat(r.horaFin()).isEqualTo(LocalTime.of(10, 0));
		assertThat(r.vecesPospuesta()).isEqualTo(1);
	}

	@Test
	void posponerVariasVecesAcumulaElContador() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.PENDIENTE);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		service.posponer(1L, null);
		TareaResponse r = service.posponer(1L, null);

		assertThat(r.vecesPospuesta()).isEqualTo(2);
		assertThat(r.fecha()).isEqualTo(DIA.plusDays(2));
	}

	@Test
	void posponerInexistenteFalla() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.posponer(1L, null)).isInstanceOf(TareaNoEncontradaException.class);
	}

	@Test
	void posponerUnaTareaHechaFalla() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.HECHO);
		existe(t);

		assertThatThrownBy(() -> service.posponer(1L, null)).isInstanceOf(TareaEstadoInvalidaException.class);
		assertThat(t.getFecha()).isEqualTo(DIA);
		assertThat(t.getVecesPospuesta()).isZero();
		verify(repository, never()).save(any());
	}

	@Test
	void posponerUnaTareaCanceladaFalla() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.CANCELADO);
		existe(t);

		assertThatThrownBy(() -> service.posponer(1L, null)).isInstanceOf(TareaEstadoInvalidaException.class);
		verify(repository, never()).save(any());
	}

	@Test
	void posponerSinFechaYSinBodyFalla() {
		existe(agendada(1, "sin agendar", null, null, null, Estado.PENDIENTE));

		assertThatThrownBy(() -> service.posponer(1L, null)).isInstanceOf(TareaInvalidaException.class);
		verify(repository, never()).save(any());
	}

	@Test
	void posponerUnaTareaSinFechaConFechaExplicitaLaAgenda() {
		Tarea t = agendada(1, "sin agendar", null, null, null, Estado.PENDIENTE);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		assertThat(service.posponer(1L, new PosponerRequest(DIA)).fecha()).isEqualTo(DIA);
	}

	@Test
	void posponerAUnaFechaNoPosteriorFalla() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.PENDIENTE);
		existe(t);

		assertThatThrownBy(() -> service.posponer(1L, new PosponerRequest(DIA)))
				.isInstanceOf(TareaInvalidaException.class);
		assertThatThrownBy(() -> service.posponer(1L, new PosponerRequest(DIA.minusDays(1))))
				.isInstanceOf(TareaInvalidaException.class);
		verify(repository, never()).save(any());
	}

	// ---- Atrasadas ----

	private static final List<Estado> ABIERTOS = List.of(Estado.PENDIENTE, Estado.EN_PROGRESO, Estado.EN_PAUSA);

	@Test
	void atrasadasOrdenaPorFechaYLuegoPrioridadAltaPrimero() {
		LocalDate hoy = LocalDate.of(2026, 11, 6);
		when(repository.findByUsuarioIdAndFechaBeforeAndEstadoIn(TareaService.USUARIO_ID, hoy, ABIERTOS)).thenReturn(List.of(
				agendada(1, "reciente alta", hoy.minusDays(1), null, Prioridad.ALTA, Estado.PENDIENTE),
				agendada(2, "vieja baja", hoy.minusDays(5), null, Prioridad.BAJA, Estado.PENDIENTE),
				agendada(3, "vieja sin prioridad", hoy.minusDays(5), null, null, Estado.EN_PAUSA),
				agendada(4, "vieja alta", hoy.minusDays(5), null, Prioridad.ALTA, Estado.EN_PROGRESO),
				agendada(5, "vieja media", hoy.minusDays(5), null, Prioridad.MEDIA, Estado.PENDIENTE),
				agendada(6, "vieja alta b", hoy.minusDays(5), null, Prioridad.ALTA, Estado.PENDIENTE)));

		assertThat(service.atrasadas(hoy)).extracting(TareaResponse::titulo).containsExactly(
				"vieja alta", "vieja alta b", "vieja media", "vieja baja", "vieja sin prioridad", "reciente alta");
	}

	@Test
	void atrasadasSinResultadosDevuelveListaVacia() {
		LocalDate hoy = LocalDate.of(2026, 11, 6);
		when(repository.findByUsuarioIdAndFechaBeforeAndEstadoIn(TareaService.USUARIO_ID, hoy, ABIERTOS))
				.thenReturn(List.of());

		assertThat(service.atrasadas(hoy)).isEmpty();
	}

	// ---- Reabrir ----

	@Test
	void reabrirUnaTareaHechaLaDejaPendiente() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.HECHO);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		TareaResponse r = service.reabrir(1L);

		assertThat(r.estado()).isEqualTo(Estado.PENDIENTE);
		assertThat(t.getFecha()).isEqualTo(DIA);
		verify(repository).save(t);
	}

	@ParameterizedTest
	@EnumSource(value = Estado.class, names = {"PENDIENTE", "EN_PROGRESO", "EN_PAUSA"})
	void reabrirUnaTareaYaAbiertaNoCambiaNada(Estado estado) {
		Tarea t = agendada(1, "a", DIA, null, null, estado);
		existe(t);

		TareaResponse r = service.reabrir(1L);

		assertThat(r.estado()).isEqualTo(estado);
		verify(repository, never()).save(any());
	}

	@Test
	void reabrirUnaTareaCanceladaFalla() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.CANCELADO);
		existe(t);

		assertThatThrownBy(() -> service.reabrir(1L))
				.isInstanceOf(TareaEstadoInvalidaException.class)
				.hasMessageContaining("cancelada");
		assertThat(t.getEstado()).isEqualTo(Estado.CANCELADO);
		verify(repository, never()).save(any());
	}

	@Test
	void reabrirInexistenteFalla() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.reabrir(1L)).isInstanceOf(TareaNoEncontradaException.class);
	}

	// ---- Jerarquía: padre existente y sin ciclos ----

	private static Tarea conPadre(long id, Long padreId) {
		Tarea t = tarea("t" + id);
		ReflectionTestUtils.setField(t, "id", id);
		t.setPadreId(padreId);
		return t;
	}

	@Test
	void elMensajeDelPadreInexistenteEstaEnFemenino() {
		when(repository.findByIdAndUsuarioId(99L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.crear(request(null, null, null, 99L)))
				.isInstanceOf(TareaInvalidaException.class)
				.hasMessage("La tarea padre no existe: 99");
	}

	@Test
	void elMensajeDelPropioPadreEstaEnFemenino() {
		existe(conPadre(1, null));

		assertThatThrownBy(() -> service.actualizar(1L, request(null, null, null, 1L)))
				.isInstanceOf(TareaInvalidaException.class)
				.hasMessage("Una tarea no puede ser su propio padre");
		verify(repository, never()).save(any());
	}

	@Test
	void ponerUnaTareaBajoSuHijaDirectaEsCicloAbA() {
		// B es hija de A: poner A bajo B daría A -> B -> A.
		existe(conPadre(1, null));
		existe(conPadre(2, 1L));

		assertThatThrownBy(() -> service.actualizar(1L, request(null, null, null, 2L)))
				.isInstanceOf(TareaInvalidaException.class)
				.hasMessage("Ciclo en la jerarquía: la tarea 2 es descendiente de la tarea 1");
		verify(repository, never()).save(any());
	}

	@Test
	void ponerUnaTareaBajoUnaDescendienteIndirectaEsCiclo() {
		// A(1) -> B(2) -> C(3): poner A bajo C cierra el ciclo A -> C -> B -> A.
		existe(conPadre(1, null));
		existe(conPadre(2, 1L));
		existe(conPadre(3, 2L));

		assertThatThrownBy(() -> service.actualizar(1L, request(null, null, null, 3L)))
				.isInstanceOf(TareaInvalidaException.class)
				.hasMessageContaining("Ciclo");
		verify(repository, never()).save(any());
	}

	@Test
	void moverUnaTareaBajoOtraRamaNoEsCiclo() {
		Tarea dos = conPadre(2, 1L);
		existe(dos);
		existe(conPadre(5, 4L));
		existe(conPadre(4, null));
		when(repository.save(dos)).thenReturn(dos);

		assertThat(service.actualizar(2L, request(null, null, null, 5L)).padreId()).isEqualTo(5L);
	}

	@Test
	void subirUnaTareaALaRaizOBajoUnAncestroNoEsCiclo() {
		Tarea tres = conPadre(3, 2L);
		existe(tres);
		existe(conPadre(1, null));
		when(repository.save(tres)).thenReturn(tres);

		assertThat(service.actualizar(3L, request(null, null, null, 1L)).padreId()).isEqualTo(1L);
	}

	// ---- Soporte para proyecto ----

	@Test
	void asignarProyectoGuardaElProyectoIdYLoDevuelve() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.PENDIENTE);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		TareaResponse r = service.asignarProyecto(1L, 7L);

		assertThat(t.getProyectoId()).isEqualTo(7L);
		assertThat(r.proyectoId()).isEqualTo(7L);
	}

	@Test
	void asignarProyectoNullDejaLaTareaSinProyecto() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.PENDIENTE);
		t.setProyectoId(7L);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		assertThat(service.asignarProyecto(1L, null).proyectoId()).isNull();
	}

	@Test
	void asignarProyectoAUnaTareaInexistenteFalla() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.asignarProyecto(1L, 7L)).isInstanceOf(TareaNoEncontradaException.class);
		verify(repository, never()).save(any());
	}

	@Test
	void listarPorProyectoDevuelveLasTareasDelRepository() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.PENDIENTE);
		t.setProyectoId(7L);
		when(repository.findByUsuarioIdAndProyectoIdOrderByFechaAscIdAsc(TareaService.USUARIO_ID, 7L))
				.thenReturn(List.of(t));

		assertThat(service.listarPorProyecto(7L)).extracting(TareaResponse::proyectoId).containsExactly(7L);
	}

	@Test
	void asignarObjetivoGuardaElObjetivoIdSinTocarElProyecto() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.PENDIENTE);
		t.setProyectoId(7L);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		TareaResponse r = service.asignarObjetivo(1L, 3L);

		assertThat(t.getObjetivoId()).isEqualTo(3L);
		assertThat(r.objetivoId()).isEqualTo(3L);
		assertThat(r.proyectoId()).isEqualTo(7L);
	}

	@Test
	void asignarObjetivoNullDejaLaTareaSinObjetivo() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.PENDIENTE);
		t.setObjetivoId(3L);
		existe(t);
		when(repository.save(t)).thenReturn(t);

		assertThat(service.asignarObjetivo(1L, null).objetivoId()).isNull();
	}

	@Test
	void asignarObjetivoAUnaTareaInexistenteFalla() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.asignarObjetivo(1L, 3L)).isInstanceOf(TareaNoEncontradaException.class);
		verify(repository, never()).save(any());
	}

	@Test
	void listarPorObjetivoDevuelveLasTareasDelRepository() {
		Tarea t = agendada(1, "a", DIA, null, null, Estado.PENDIENTE);
		t.setObjetivoId(3L);
		when(repository.findByUsuarioIdAndObjetivoIdOrderByFechaAscIdAsc(TareaService.USUARIO_ID, 3L))
				.thenReturn(List.of(t));

		assertThat(service.listarPorObjetivo(3L)).extracting(TareaResponse::objetivoId).containsExactly(3L);
	}

	@Test
	void existenTareasDelObjetivoDelegaEnElRepository() {
		when(repository.existsByUsuarioIdAndObjetivoId(TareaService.USUARIO_ID, 3L)).thenReturn(true);
		when(repository.existsByUsuarioIdAndObjetivoId(TareaService.USUARIO_ID, 4L)).thenReturn(false);

		assertThat(service.existenTareasDelObjetivo(3L)).isTrue();
		assertThat(service.existenTareasDelObjetivo(4L)).isFalse();
	}

	@Test
	void existenTareasDelProyectoDelegaEnElRepository() {
		when(repository.existsByUsuarioIdAndProyectoId(TareaService.USUARIO_ID, 7L)).thenReturn(true);
		when(repository.existsByUsuarioIdAndProyectoId(TareaService.USUARIO_ID, 8L)).thenReturn(false);

		assertThat(service.existenTareasDelProyecto(7L)).isTrue();
		assertThat(service.existenTareasDelProyecto(8L)).isFalse();
	}

	// ---- Recomendación ----

	private static final LocalDate HOY_REC = LocalDate.of(2026, 11, 6);

	/** Candidata de la recomendación armada a mano: padre, proyecto y objetivo opcionales. */
	private static Tarea cand(long id, String titulo, LocalDate fecha, LocalDate creada, Prioridad prioridad,
			Long padreId, Long proyectoId, Long objetivoId) {
		Tarea t = agendada(id, titulo, fecha, null, prioridad, Estado.PENDIENTE);
		t.setPadreId(padreId);
		t.setProyectoId(proyectoId);
		t.setObjetivoId(objetivoId);
		if (creada != null) {
			ReflectionTestUtils.setField(t, "fechaCreacion", creada.atStartOfDay().atOffset(java.time.ZoneOffset.UTC));
		}
		return t;
	}

	private static Tarea cand(long id, String titulo, Prioridad prioridad) {
		return cand(id, titulo, null, LocalDate.of(2026, 10, 1), prioridad, null, null, null);
	}

	private void candidatas(Tarea... tareas) {
		when(repository.findCandidatasRecomendacion(TareaService.USUARIO_ID, HOY_REC, ABIERTOS))
				.thenReturn(List.of(tareas));
	}

	private List<String> raices(List<TareaRecomendadaResponse> r) {
		return r.stream().map(x -> x.tarea().titulo()).toList();
	}

	private List<TareaRecomendadaResponse> recomendar(OrdenRecomendacion o, SentidoOrden s, Integer limite, Long p, Long ob) {
		return service.recomendacion(HOY_REC, o, s, limite, p, ob);
	}

	@Test
	void recomendacionIncluyeCadaTipoDeTarea() {
		candidatas(
				cand(1, "ninguno", null, LocalDate.of(2026, 10, 1), Prioridad.BAJA, null, null, null),
				cand(2, "con proyecto", null, LocalDate.of(2026, 10, 1), Prioridad.BAJA, null, 7L, null),
				cand(3, "con objetivo", HOY_REC.minusDays(2), null, Prioridad.BAJA, null, null, 9L),
				cand(4, "con ambos", null, LocalDate.of(2026, 10, 1), Prioridad.BAJA, null, 7L, 9L));

		assertThat(raices(recomendar(OrdenRecomendacion.PRIORIDAD, SentidoOrden.DESC, null, null, null)))
				.containsExactly("ninguno", "con proyecto", "con objetivo", "con ambos");
	}

	@Test
	void recomendacionAnidaSubtareasEnTodosLosNiveles() {
		candidatas(
				cand(1, "madre", null, LocalDate.of(2026, 10, 1), Prioridad.ALTA, null, null, null),
				cand(2, "hija", null, LocalDate.of(2026, 10, 1), null, 1L, null, null),
				cand(3, "nieta", null, LocalDate.of(2026, 10, 1), null, 2L, null, null));

		List<TareaRecomendadaResponse> r = recomendar(null, null, null, null, null);

		assertThat(raices(r)).containsExactly("madre");
		TareaRecomendadaResponse hija = r.get(0).subtareas().get(0);
		assertThat(hija.tarea().titulo()).isEqualTo("hija");
		assertThat(hija.subtareas()).extracting(x -> x.tarea().titulo()).containsExactly("nieta");
		assertThat(hija.subtareas().get(0).subtareas()).isEmpty();
	}

	@Test
	void recomendacionSubtareaSueltaSoloSiLaMadreNoEsCandidata() {
		// La madre (id 1) no está entre las candidatas (p. ej. HECHO o con fecha futura): la hija sale como raíz.
		candidatas(
				cand(2, "hija huerfana", null, LocalDate.of(2026, 10, 1), null, 1L, null, null),
				cand(3, "otra", null, LocalDate.of(2026, 10, 1), null, null, null, null));

		assertThat(raices(recomendar(null, null, null, null, null))).containsExactly("hija huerfana", "otra");
	}

	@Test
	void recomendacionPrioridadDescYAscConSinPrioridadSiempreAlFinal() {
		candidatas(cand(1, "sin", null), cand(2, "media", Prioridad.MEDIA), cand(3, "alta", Prioridad.ALTA),
				cand(4, "baja", Prioridad.BAJA), cand(5, "alta b", Prioridad.ALTA));

		assertThat(raices(recomendar(OrdenRecomendacion.PRIORIDAD, SentidoOrden.DESC, null, null, null)))
				.containsExactly("alta", "alta b", "media", "baja", "sin");
		assertThat(raices(recomendar(OrdenRecomendacion.PRIORIDAD, SentidoOrden.ASC, null, null, null)))
				.containsExactly("baja", "media", "alta", "alta b", "sin");
	}

	@Test
	void recomendacionAntiguedadUsaFechaOCreacionYDescPoneLaMasAntiguaPrimero() {
		candidatas(
				cand(1, "creada reciente", null, LocalDate.of(2026, 11, 1), null, null, null, null),
				cand(2, "fecha vieja", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 11, 1), null, null, null, null),
				cand(3, "creada antigua", null, LocalDate.of(2026, 8, 1), null, null, null, null),
				cand(4, "creada reciente b", null, LocalDate.of(2026, 11, 1), null, null, null, null));

		assertThat(raices(recomendar(OrdenRecomendacion.ANTIGUEDAD, SentidoOrden.DESC, null, null, null)))
				.containsExactly("creada antigua", "fecha vieja", "creada reciente", "creada reciente b");
		assertThat(raices(recomendar(OrdenRecomendacion.ANTIGUEDAD, SentidoOrden.ASC, null, null, null)))
				.containsExactly("creada reciente", "creada reciente b", "fecha vieja", "creada antigua");
	}

	@Test
	void recomendacionAntiguedadToleraFechaCreacionNula() {
		// Entidades armadas a mano: sin fecha ni fechaCreacion cuentan como la más reciente, sin NullPointerException.
		candidatas(
				cand(1, "sin nada", null, null, null, null, null, null),
				cand(2, "con fecha", HOY_REC.minusDays(1), null, null, null, null, null));

		assertThat(raices(recomendar(OrdenRecomendacion.ANTIGUEDAD, SentidoOrden.DESC, null, null, null)))
				.containsExactly("con fecha", "sin nada");
	}

	@Test
	void recomendacionLimiteSeAplicaDespuesDeOrdenar() {
		candidatas(cand(1, "baja", Prioridad.BAJA), cand(2, "alta", Prioridad.ALTA), cand(3, "media", Prioridad.MEDIA));

		assertThat(raices(recomendar(OrdenRecomendacion.PRIORIDAD, SentidoOrden.DESC, 2, null, null)))
				.containsExactly("alta", "media");
	}

	@Test
	void recomendacionLimiteSeAplicaALasRaicesYNoCuentaSubtareas() {
		candidatas(
				cand(1, "madre", null, LocalDate.of(2026, 10, 1), Prioridad.ALTA, null, null, null),
				cand(2, "hija", null, LocalDate.of(2026, 10, 1), null, 1L, null, null),
				cand(3, "otra", Prioridad.BAJA));

		List<TareaRecomendadaResponse> r = recomendar(OrdenRecomendacion.PRIORIDAD, SentidoOrden.DESC, 1, null, null);

		assertThat(raices(r)).containsExactly("madre");
		assertThat(r.get(0).subtareas()).hasSize(1);
	}

	@Test
	void recomendacionLimiteSinIndicarUsaElTopePorDefectoYElMaximoRecorta() {
		Tarea[] muchas = new Tarea[250];
		for (int i = 0; i < muchas.length; i++) {
			muchas[i] = cand(i + 1, "t" + i, null);
		}
		candidatas(muchas);

		assertThat(recomendar(null, null, null, null, null)).hasSize(TareaService.LIMITE_RECOMENDACION_DEFECTO);
		assertThat(recomendar(null, null, 1000, null, null)).hasSize(TareaService.LIMITE_RECOMENDACION_MAXIMO);
	}

	@Test
	void recomendacionLimiteNoPositivoLanza400() {
		assertThatThrownBy(() -> recomendar(null, null, 0, null, null)).isInstanceOf(TareaInvalidaException.class);
		assertThatThrownBy(() -> recomendar(null, null, -3, null, null)).isInstanceOf(TareaInvalidaException.class);
	}

	@Test
	void recomendacionFiltraPorProyectoYPorObjetivo() {
		candidatas(
				cand(1, "p7", null, LocalDate.of(2026, 10, 1), null, null, 7L, null),
				cand(2, "p8", null, LocalDate.of(2026, 10, 1), null, null, 8L, null),
				cand(3, "o9", null, LocalDate.of(2026, 10, 1), null, null, null, 9L),
				cand(4, "p7 o9", null, LocalDate.of(2026, 10, 1), null, null, 7L, 9L));

		assertThat(raices(recomendar(null, null, null, 7L, null))).containsExactly("p7", "p7 o9");
		assertThat(raices(recomendar(null, null, null, null, 9L))).containsExactly("o9", "p7 o9");
		assertThat(raices(recomendar(null, null, null, 7L, 9L))).containsExactly("p7 o9");
	}

	@Test
	void recomendacionConFiltroAnidaLasHijasAunqueNoCumplanElFiltro() {
		// Madre del proyecto P con una subtarea sin proyecto: filtrando por P la subtarea sale anidada, no suelta.
		candidatas(
				cand(1, "madre P", null, LocalDate.of(2026, 10, 1), null, null, 7L, null),
				cand(2, "hija sin proyecto", null, LocalDate.of(2026, 10, 1), null, 1L, null, null));

		List<TareaRecomendadaResponse> r = recomendar(null, null, null, 7L, null);

		assertThat(raices(r)).containsExactly("madre P");
		assertThat(r.get(0).subtareas()).extracting(x -> x.tarea().titulo()).containsExactly("hija sin proyecto");
	}

	@Test
	void recomendacionConFiltroNietaQueCumpleApareceUnaSolaVezBajoLaAbuela() {
		// Abuela P, madre candidata sin P, nieta P: la nieta NO es raíz porque un ancestro ya cumple el filtro.
		candidatas(
				cand(1, "abuela P", null, LocalDate.of(2026, 10, 1), null, null, 7L, null),
				cand(2, "madre sin P", null, LocalDate.of(2026, 10, 1), null, 1L, null, null),
				cand(3, "nieta P", null, LocalDate.of(2026, 10, 1), null, 2L, 7L, null));

		List<TareaRecomendadaResponse> r = recomendar(null, null, null, 7L, null);

		assertThat(raices(r)).containsExactly("abuela P");
		TareaRecomendadaResponse madre = r.get(0).subtareas().get(0);
		assertThat(madre.tarea().titulo()).isEqualTo("madre sin P");
		assertThat(madre.subtareas()).extracting(x -> x.tarea().titulo()).containsExactly("nieta P");
	}

	@Test
	void recomendacionConFiltroHijaQueCumpleConMadreQueNoCumpleEsRaiz() {
		candidatas(
				cand(1, "madre sin P", null, LocalDate.of(2026, 10, 1), null, null, null, null),
				cand(2, "hija P", null, LocalDate.of(2026, 10, 1), null, 1L, 7L, null));

		List<TareaRecomendadaResponse> r = recomendar(null, null, null, 7L, null);

		assertThat(raices(r)).containsExactly("hija P");
		assertThat(r.get(0).subtareas()).isEmpty();
	}

	@Test
	void recomendacionOrdenaTambienLasSubtareas() {
		candidatas(
				cand(1, "madre", null, LocalDate.of(2026, 10, 1), null, null, null, null),
				cand(2, "hija baja", null, LocalDate.of(2026, 10, 1), Prioridad.BAJA, 1L, null, null),
				cand(3, "hija alta", null, LocalDate.of(2026, 10, 1), Prioridad.ALTA, 1L, null, null));

		List<TareaRecomendadaResponse> r = recomendar(OrdenRecomendacion.PRIORIDAD, SentidoOrden.DESC, null, null, null);

		assertThat(r.get(0).subtareas()).extracting(x -> x.tarea().titulo()).containsExactly("hija alta", "hija baja");
	}

	@Test
	void recomendacionSinCandidatasDevuelveListaVacia() {
		candidatas();

		assertThat(recomendar(null, null, null, null, null)).isEmpty();
	}

	// ---- Agendar tarea con sus subtareas ----

	private static final LocalDate NUEVA = HOY_REC.plusDays(5);

	private static AgendarRequest agendarReq(Boolean incluir) {
		return new AgendarRequest(NUEVA, HOY_REC, incluir);
	}

	/** Madre abierta y existente; devuelve las ids de lo que agendar modificó, en orden. */
	private List<Long> agendar(Tarea madre, Boolean incluir) {
		existe(madre);
		when(repository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
		return service.agendar(madre.getId(), agendarReq(incluir)).stream().map(TareaResponse::id).toList();
	}

	private static Tarea madreAgendable(long id, LocalDate fecha, Estado estado) {
		Tarea t = cand(id, "madre", fecha, LocalDate.of(2026, 10, 1), null, null, null, null);
		t.setEstado(estado);
		return t;
	}

	private static Tarea hija(long id, long padreId, LocalDate fecha, Prioridad prioridad) {
		return cand(id, "t" + id, fecha, LocalDate.of(2026, 10, 1), prioridad, padreId, null, null);
	}

	@Test
	void agendarMadreSinHijasAtrasadaLimpiaHorasYSumaPospuesta() {
		Tarea madre = madreAgendable(1, HOY_REC.minusDays(3), Estado.EN_PROGRESO);
		madre.setHoraInicio(LocalTime.of(9, 0));
		madre.setHoraFin(LocalTime.of(10, 0));
		candidatas(madre);

		assertThat(agendar(madre, null)).containsExactly(1L);

		assertThat(madre.getFecha()).isEqualTo(NUEVA);
		assertThat(madre.getHoraInicio()).isNull();
		assertThat(madre.getHoraFin()).isNull();
		assertThat(madre.getVecesPospuesta()).isEqualTo(1);
		assertThat(madre.getEstado()).isEqualTo(Estado.EN_PROGRESO); // los estados no se tocan
	}

	@Test
	void agendarMadreSinFechaNoSumaPospuesta() {
		Tarea madre = madreAgendable(1, null, Estado.PENDIENTE);
		candidatas(madre);

		agendar(madre, true);

		assertThat(madre.getFecha()).isEqualTo(NUEVA);
		assertThat(madre.getVecesPospuesta()).isZero();
	}

	@Test
	void agendarMuevePorDefectoLasHijasSinFechaYAtrasadasYSumaSoloEnLasAtrasadas() {
		Tarea madre = madreAgendable(1, HOY_REC.minusDays(1), Estado.PENDIENTE);
		Tarea sinFecha = hija(2, 1, null, null);
		Tarea atrasada = hija(3, 1, HOY_REC.minusDays(4), null);
		atrasada.setHoraInicio(LocalTime.of(8, 0));
		candidatas(madre, sinFecha, atrasada);

		assertThat(agendar(madre, null)).containsExactly(1L, 2L, 3L);

		assertThat(List.of(madre, sinFecha, atrasada)).allSatisfy(t -> {
			assertThat(t.getFecha()).isEqualTo(NUEVA);
			assertThat(t.getHoraInicio()).isNull();
		});
		assertThat(madre.getVecesPospuesta()).isEqualTo(1);
		assertThat(sinFecha.getVecesPospuesta()).isZero();
		assertThat(atrasada.getVecesPospuesta()).isEqualTo(1);
	}

	@Test
	void agendarMadreConFechaFuturaMueveSusHijasCandidatas() {
		// La madre no es candidata (fecha futura) pero se agenda igual; sus hijas candidatas se mueven con ella.
		Tarea madre = madreAgendable(1, HOY_REC.plusDays(3), Estado.PENDIENTE);
		Tarea sinFecha = hija(2, 1, null, null);
		Tarea atrasada = hija(3, 1, HOY_REC.minusDays(2), null);
		candidatas(sinFecha, atrasada); // la madre no sale en la consulta de candidatas

		assertThat(agendar(madre, true)).containsExactly(1L, 2L, 3L);

		assertThat(List.of(madre, sinFecha, atrasada)).allSatisfy(t -> assertThat(t.getFecha()).isEqualTo(NUEVA));
		assertThat(madre.getVecesPospuesta()).isZero();    // no estaba atrasada
		assertThat(sinFecha.getVecesPospuesta()).isZero(); // no tenía fecha
		assertThat(atrasada.getVecesPospuesta()).isEqualTo(1);
	}

	@Test
	void agendarMadreConFechaDeHoyMueveLaHijaSinFecha() {
		Tarea madre = madreAgendable(1, HOY_REC, Estado.PENDIENTE);
		Tarea sinFecha = hija(2, 1, null, null);
		candidatas(sinFecha);

		assertThat(agendar(madre, true)).containsExactly(1L, 2L);

		assertThat(sinFecha.getFecha()).isEqualTo(NUEVA);
		assertThat(madre.getFecha()).isEqualTo(NUEVA);
		assertThat(madre.getVecesPospuesta()).isZero();
	}

	@Test
	void agendarRespetaHijasDeHoyFuturasYHechas() {
		// Las de hoy/futuras y las HECHO/CANCELADO no son candidatas: la consulta no las trae y no se tocan.
		Tarea madre = madreAgendable(1, null, Estado.PENDIENTE);
		Tarea candidata = hija(2, 1, null, null);
		Tarea deHoy = hija(3, 1, HOY_REC, null);
		Tarea futura = hija(4, 1, HOY_REC.plusDays(9), null);
		Tarea hecha = hija(5, 1, HOY_REC.minusDays(2), null);
		hecha.setEstado(Estado.HECHO);
		candidatas(madre, candidata);

		assertThat(agendar(madre, true)).containsExactly(1L, 2L);

		assertThat(deHoy.getFecha()).isEqualTo(HOY_REC);
		assertThat(futura.getFecha()).isEqualTo(HOY_REC.plusDays(9));
		assertThat(hecha.getFecha()).isEqualTo(HOY_REC.minusDays(2));
		assertThat(hecha.getVecesPospuesta()).isZero();
	}

	@Test
	void agendarBajaPorVariosNivelesEnOrdenDeArbol() {
		Tarea madre = madreAgendable(1, null, Estado.PENDIENTE);
		Tarea hijaBaja = hija(2, 1, null, Prioridad.BAJA);
		Tarea hijaAlta = hija(3, 1, null, Prioridad.ALTA);
		Tarea nieta = hija(4, 3, HOY_REC.minusDays(1), null);
		Tarea bisnieta = hija(5, 4, null, null);
		candidatas(madre, hijaBaja, hijaAlta, nieta, bisnieta);

		// Madre primero y luego preorden: la hija ALTA con su subárbol antes que la BAJA.
		assertThat(agendar(madre, true)).containsExactly(1L, 3L, 4L, 5L, 2L);
		assertThat(nieta.getVecesPospuesta()).isEqualTo(1);
		assertThat(bisnieta.getVecesPospuesta()).isZero();
	}

	@Test
	void agendarNoBajaATravesDeUnDescendienteNoCandidato() {
		// La hija (2) tiene fecha futura: no es candidata, así que su hija (3), aunque sí lo sea, no se mueve.
		Tarea madre = madreAgendable(1, null, Estado.PENDIENTE);
		Tarea hijaFutura = hija(2, 1, HOY_REC.plusDays(4), null);
		Tarea nieta = hija(3, 2, null, null);
		candidatas(madre, nieta);

		assertThat(agendar(madre, true)).containsExactly(1L);

		assertThat(nieta.getFecha()).isNull();
		assertThat(hijaFutura.getFecha()).isEqualTo(HOY_REC.plusDays(4));
	}

	@Test
	void agendarSinIncluirSubtareasMueveSoloLaMadreYNoConsultaCandidatas() {
		Tarea madre = madreAgendable(1, null, Estado.PENDIENTE);
		Tarea hija = hija(2, 1, null, null);

		assertThat(agendar(madre, false)).containsExactly(1L);

		assertThat(hija.getFecha()).isNull();
		verify(repository, never()).findCandidatasRecomendacion(any(), any(), any());
	}

	@ParameterizedTest
	@EnumSource(value = Estado.class, names = {"HECHO", "CANCELADO"})
	void agendarMadreCerradaLanza409SinCambios(Estado estado) {
		Tarea madre = madreAgendable(1, HOY_REC.minusDays(1), estado);
		existe(madre);

		assertThatThrownBy(() -> service.agendar(1L, agendarReq(true))).isInstanceOf(TareaEstadoInvalidaException.class);

		assertThat(madre.getFecha()).isEqualTo(HOY_REC.minusDays(1));
		verify(repository, never()).saveAll(any());
	}

	@Test
	void agendarConFechaAnteriorAHoyLanza400SinCambios() {
		Tarea madre = madreAgendable(1, null, Estado.PENDIENTE);
		existe(madre);

		assertThatThrownBy(() -> service.agendar(1L, new AgendarRequest(HOY_REC.minusDays(1), HOY_REC, true)))
				.isInstanceOf(TareaInvalidaException.class);

		assertThat(madre.getFecha()).isNull();
		verify(repository, never()).saveAll(any());
	}

	@Test
	void agendarParaHoyEsValido() {
		Tarea madre = madreAgendable(1, HOY_REC.minusDays(2), Estado.PENDIENTE);
		existe(madre);
		when(repository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
		candidatas(madre);

		service.agendar(1L, new AgendarRequest(HOY_REC, HOY_REC, true));

		assertThat(madre.getFecha()).isEqualTo(HOY_REC);
	}

	@Test
	void agendarSinFechaOSinHoyLanza400() {
		Tarea madre = madreAgendable(1, null, Estado.PENDIENTE);
		existe(madre);

		assertThatThrownBy(() -> service.agendar(1L, new AgendarRequest(null, HOY_REC, true)))
				.isInstanceOf(TareaInvalidaException.class);
		assertThatThrownBy(() -> service.agendar(1L, new AgendarRequest(NUEVA, null, true)))
				.isInstanceOf(TareaInvalidaException.class);
	}

	@Test
	void agendarTareaInexistenteLanza404() {
		when(repository.findByIdAndUsuarioId(99L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.agendar(99L, agendarReq(true))).isInstanceOf(TareaNoEncontradaException.class);
	}

	private static void aplanar(TareaRecomendadaResponse nodo, List<Long> salida) {
		nodo.subtareas().forEach(h -> {
			salida.add(h.tarea().id());
			aplanar(h, salida);
		});
	}

	@Test
	void agendarMueveExactamenteLoQueLaVistaPreviaAnidaBajoLaMadre() {
		Tarea madre = madreAgendable(1, null, Estado.PENDIENTE);
		madre.setPrioridad(Prioridad.ALTA);
		Tarea h1 = hija(2, 1, null, Prioridad.BAJA);
		Tarea h2 = hija(3, 1, HOY_REC.minusDays(3), Prioridad.ALTA);
		Tarea n1 = hija(4, 3, null, null);
		Tarea n2 = hija(5, 3, null, Prioridad.MEDIA);
		Tarea otra = cand(9, "otra", Prioridad.BAJA);
		candidatas(madre, h1, h2, n1, n2, otra);

		TareaRecomendadaResponse enVistaPrevia = service.recomendacion(HOY_REC, null, null, null, null, null).stream()
				.filter(r -> r.tarea().id() == 1L).findFirst().orElseThrow();
		List<Long> esperado = new java.util.ArrayList<>(List.of(1L));
		aplanar(enVistaPrevia, esperado);

		assertThat(agendar(madre, true)).containsExactlyElementsOf(esperado);
		assertThat(otra.getFecha()).isNull();
	}

	@Test
	void ordenYSentidoTienenDefectoYRechazanValoresInvalidos() {
		assertThat(OrdenRecomendacion.desde(null)).isEqualTo(OrdenRecomendacion.PRIORIDAD);
		assertThat(OrdenRecomendacion.desde("Antiguedad")).isEqualTo(OrdenRecomendacion.ANTIGUEDAD);
		assertThat(SentidoOrden.desde(null)).isEqualTo(SentidoOrden.DESC);
		assertThat(SentidoOrden.desde("ASC")).isEqualTo(SentidoOrden.ASC);
		assertThatThrownBy(() -> OrdenRecomendacion.desde("raro")).isInstanceOf(TareaInvalidaException.class);
		assertThatThrownBy(() -> SentidoOrden.desde("raro")).isInstanceOf(TareaInvalidaException.class);
	}
}
