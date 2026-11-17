package com.agoals.usuario;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** Reloj de prueba que solo avanza cuando el test se lo pide. */
class RelojMovible extends Clock {

	private volatile Instant ahora;

	RelojMovible(Instant inicio) {
		this.ahora = inicio;
	}

	void avanzar(Duration d) {
		ahora = ahora.plus(d);
	}

	@Override
	public ZoneId getZone() {
		return ZoneOffset.UTC;
	}

	@Override
	public Clock withZone(ZoneId zone) {
		return this;
	}

	@Override
	public Instant instant() {
		return ahora;
	}
}
