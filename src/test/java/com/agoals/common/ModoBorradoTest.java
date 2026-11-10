package com.agoals.common;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ModoBorradoTest {

	static class Falla extends RuntimeException {
		Falla(String mensaje) {
			super(mensaje);
		}
	}

	private static ModoBorrado desde(String texto) {
		return ModoBorrado.desde("tareas", texto, Falla::new);
	}

	@Test
	void nuloOVacioSignificaSinEleccion() {
		assertThat(desde(null)).isNull();
		assertThat(desde("")).isNull();
		assertThat(desde("   ")).isNull();
	}

	@Test
	void ignoraMayusculasYEspacios() {
		assertThat(desde("borrar")).isEqualTo(ModoBorrado.BORRAR);
		assertThat(desde("BORRAR")).isEqualTo(ModoBorrado.BORRAR);
		assertThat(desde(" Conservar ")).isEqualTo(ModoBorrado.CONSERVAR);
	}

	@Test
	void valorInvalidoLanzaLaExcepcionDelModuloConElNombreDelParametro() {
		assertThatThrownBy(() -> desde("raro"))
				.isInstanceOf(Falla.class)
				.hasMessage("tareas inválido: 'raro' (use borrar o conservar)");
	}
}
