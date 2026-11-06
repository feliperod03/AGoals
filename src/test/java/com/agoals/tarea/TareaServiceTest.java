package com.agoals.tarea;

import com.agoals.tarea.dto.AgendaResponse;
import com.agoals.tarea.dto.PosponerRequest;
import com.agoals.tarea.dto.TareaRequest;
import com.agoals.tarea.dto.TareaResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import static org.mockito.Mockito.never;
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

	@Test
	void eliminarExistenteLaBorra() {
		Tarea existente = tarea("a");
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.of(existente));

		service.eliminar(1L);

		verify(repository).delete(existente);
	}

	@Test
	void eliminarInexistenteFalla() {
		when(repository.findByIdAndUsuarioId(1L, TareaService.USUARIO_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.eliminar(1L)).isInstanceOf(TareaNoEncontradaException.class);
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
}
