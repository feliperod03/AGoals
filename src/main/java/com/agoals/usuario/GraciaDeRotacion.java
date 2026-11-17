package com.agoals.usuario;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Recuerda, por serie, el token que acaba de rotarse en el login automático (remember-me). Sirve para que varias
 * peticiones en paralelo con la misma cookie (la SPA refetchea varias queries a la vez al volver a una pestaña) no
 * se tomen como robo: la primera rota el token y las demás, si llegan dentro de la ventana, entran con el token
 * nuevo sin volver a rotar. Mapa LRU acotado, con limpieza de vencidos como mucho una vez por minuto.
 * No es thread-safe por sí sola: la usa RecordarmeServices dentro de un método synchronized.
 */
class GraciaDeRotacion {

	record Rotacion(String usuario, String anterior, String nuevo, Instant instante) {
	}

	private static final Duration LIMPIEZA_CADA = Duration.ofMinutes(1);

	private final Duration ventana;
	private final Map<String, Rotacion> porSerie;
	private Instant ultimaLimpieza;

	GraciaDeRotacion(Duration ventana, int maxEntradas, Instant ahora) {
		this.ventana = ventana;
		this.ultimaLimpieza = ahora;
		this.porSerie = new LinkedHashMap<>(16, 0.75f, true) {
			@Override
			protected boolean removeEldestEntry(Map.Entry<String, Rotacion> eldest) {
				return size() > maxEntradas;
			}
		};
	}

	/** La rotación de esa serie si todavía está dentro de la ventana; si no, null. */
	Rotacion vigente(String serie, Instant ahora) {
		limpiar(ahora);
		Rotacion r = porSerie.get(serie);
		return r != null && ahora.isBefore(r.instante().plus(ventana)) ? r : null;
	}

	void registrar(String serie, String usuario, String anterior, String nuevo, Instant ahora) {
		limpiar(ahora);
		porSerie.put(serie, new Rotacion(usuario, anterior, nuevo, ahora));
	}

	void borrarSerie(String serie) {
		porSerie.remove(serie);
	}

	void borrarTodo() {
		porSerie.clear();
	}

	int tamano() {
		return porSerie.size();
	}

	private void limpiar(Instant ahora) {
		if (ahora.isBefore(ultimaLimpieza.plus(LIMPIEZA_CADA))) {
			return;
		}
		ultimaLimpieza = ahora;
		porSerie.values().removeIf(r -> !ahora.isBefore(r.instante().plus(ventana)));
	}
}
