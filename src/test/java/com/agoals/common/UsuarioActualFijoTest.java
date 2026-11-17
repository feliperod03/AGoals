package com.agoals.common;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UsuarioActualFijoTest {

	@Test
	void devuelveElUsuarioPorDefectoDeV2() {
		assertThat(new UsuarioActualFijo().id()).isEqualTo(1L);
	}
}
