package com.agoals.objetivo;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ObjetivoConsultaServiceTest {

	@Mock
	ObjetivoRepository repository;

	@InjectMocks
	ObjetivoConsultaService service;

	@Test
	void validarExisteNoHaceNadaSiElObjetivoExiste() {
		when(repository.existsByIdAndUsuarioId(3L, ObjetivoService.USUARIO_ID)).thenReturn(true);

		assertThatCode(() -> service.validarExiste(3L)).doesNotThrowAnyException();
	}

	@Test
	void validarExisteDa400ConElMensajeSiNoExiste() {
		when(repository.existsByIdAndUsuarioId(77L, ObjetivoService.USUARIO_ID)).thenReturn(false);

		assertThatThrownBy(() -> service.validarExiste(77L))
				.isInstanceOf(ObjetivoInvalidoException.class)
				.hasMessage("El objetivo no existe: 77");
	}

	// Guarda de arquitectura: si esta clase depende de otro service (p. ej. ProyectoService u ObjetivoService),
	// reaparece el ciclo de beans proyecto <-> objetivo. Debe depender SOLO de ObjetivoRepository.
	@Test
	void dependeUnicamenteDeObjetivoRepository() {
		var constructores = ObjetivoConsultaService.class.getConstructors();

		assertThat(constructores).hasSize(1);
		assertThat(constructores[0].getParameterTypes()).containsExactly(ObjetivoRepository.class);
	}
}
