package com.agoals.tarea;

import com.agoals.tarea.dto.TareaRequest;
import com.agoals.tarea.dto.TareaResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
}
