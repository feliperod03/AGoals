package com.agoals.proyecto;

import com.agoals.common.UsuarioActual;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProyectoConsultaServiceTest {

	private static final Long U = 42L;

	@Mock
	ProyectoRepository repository;

	@Mock
	UsuarioActual usuarioActual;

	@BeforeEach
	void usuarioActualDePrueba() {
		lenient().when(usuarioActual.id()).thenReturn(U);
	}

	@InjectMocks
	ProyectoConsultaService service;

	@Test
	void validarExisteNoHaceNadaSiElProyectoExiste() {
		when(repository.existsByIdAndUsuarioId(3L, U)).thenReturn(true);

		assertThatCode(() -> service.validarExiste(3L)).doesNotThrowAnyException();
	}

	@Test
	void validarExisteDa400ConElMensajeSiNoExiste() {
		when(repository.existsByIdAndUsuarioId(77L, U)).thenReturn(false);

		assertThatThrownBy(() -> service.validarExiste(77L))
				.isInstanceOf(ProyectoInvalidoException.class)
				.hasMessage("El proyecto no existe: 77");
	}

	// Guarda de arquitectura: si esta clase depende de otro service (p. ej. ProyectoService o IdeaService),
	// reaparece un ciclo de beans (idea <-> proyecto). Debe depender SOLO de ProyectoRepository y UsuarioActual.
	@Test
	void dependeUnicamenteDeProyectoRepository() {
		var constructores = ProyectoConsultaService.class.getConstructors();

		assertThat(constructores).hasSize(1);
		assertThat(constructores[0].getParameterTypes()).containsExactly(ProyectoRepository.class, UsuarioActual.class);
	}
}
