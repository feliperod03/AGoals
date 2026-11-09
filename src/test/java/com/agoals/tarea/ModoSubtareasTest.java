package com.agoals.tarea;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ModoSubtareasTest {

	@Test
	void nuloOVacioSignificaSinEleccion() {
		assertThat(ModoSubtareas.desde(null)).isNull();
		assertThat(ModoSubtareas.desde("")).isNull();
		assertThat(ModoSubtareas.desde("   ")).isNull();
	}

	@Test
	void ignoraMayusculasYEspacios() {
		assertThat(ModoSubtareas.desde("borrar")).isEqualTo(ModoSubtareas.BORRAR);
		assertThat(ModoSubtareas.desde("BORRAR")).isEqualTo(ModoSubtareas.BORRAR);
		assertThat(ModoSubtareas.desde(" Conservar ")).isEqualTo(ModoSubtareas.CONSERVAR);
	}

	@Test
	void valorInvalidoListaLosValidos() {
		assertThatThrownBy(() -> ModoSubtareas.desde("raro"))
				.isInstanceOf(TareaInvalidaException.class)
				.hasMessageContaining("borrar o conservar");
	}
}
