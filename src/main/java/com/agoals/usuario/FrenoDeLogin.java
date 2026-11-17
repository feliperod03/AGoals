package com.agoals.usuario;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Freno de intentos fallidos de login, en memoria. Cuenta los fallos por (IP, email normalizado) y, aparte, por IP.
 * El primer fallo abre una ventana; al llegar al umbral dentro de ella la clave queda bloqueada un tiempo.
 * Un login correcto reinicia el contador del par (no el de la IP).
 *
 * Los mapas son LRU y están acotados (max-entradas), y se limpian los vencidos como mucho una vez por minuto, así que
 * no crecen sin límite. El reloj se inyecta para poder probarlo.
 *
 * La IP es request.getRemoteAddr(). Detrás de un proxy hay que configurar la IP real del cliente en el despliegue
 * (nunca leer X-Forwarded-For a mano: el cliente lo puede falsificar); si no, todos comparten IP y el freno por IP
 * bloquearía a todos a la vez.
 */
@Component
public class FrenoDeLogin {

	private static final Duration LIMPIEZA_CADA = Duration.ofMinutes(1);

	private static final class Contador {
		int fallos;
		Instant inicio;
		Instant bloqueadoHasta;
	}

	private final Clock clock;
	private final int maxFallosPar;
	private final int maxFallosIp;
	private final Duration ventana;
	private final Duration bloqueo;
	private final Map<String, Contador> pares;
	private final Map<String, Contador> ips;
	private Instant ultimaLimpieza;

	public FrenoDeLogin(Clock clock,
			@Value("${agoals.seguridad.login.max-fallos-email:5}") int maxFallosPar,
			@Value("${agoals.seguridad.login.max-fallos-ip:20}") int maxFallosIp,
			@Value("${agoals.seguridad.login.ventana:15m}") Duration ventana,
			@Value("${agoals.seguridad.login.bloqueo:15m}") Duration bloqueo,
			@Value("${agoals.seguridad.login.max-entradas:10000}") int maxEntradas) {
		this.clock = clock;
		this.maxFallosPar = maxFallosPar;
		this.maxFallosIp = maxFallosIp;
		this.ventana = ventana;
		this.bloqueo = bloqueo;
		this.pares = mapaAcotado(maxEntradas);
		this.ips = mapaAcotado(maxEntradas);
		this.ultimaLimpieza = clock.instant();
	}

	private static Map<String, Contador> mapaAcotado(int max) {
		return new LinkedHashMap<>(16, 0.75f, true) {
			@Override
			protected boolean removeEldestEntry(Map.Entry<String, Contador> eldest) {
				return size() > max;
			}
		};
	}

	/** Lanza LoginBloqueadoException si el par o la IP están bloqueados. Se llama ANTES de consultar la base. */
	public synchronized void comprobar(String ip, String email) {
		Instant ahora = clock.instant();
		limpiar(ahora);
		Instant hasta = null;
		for (Instant candidato : new Instant[] { bloqueadoHasta(pares.get(clavePar(ip, email)), ahora),
				bloqueadoHasta(ips.get(ip), ahora) }) {
			if (candidato != null && (hasta == null || candidato.isAfter(hasta))) {
				hasta = candidato;
			}
		}
		if (hasta != null) {
			long segundos = Math.max(1, (Duration.between(ahora, hasta).toMillis() + 999) / 1000);
			throw new LoginBloqueadoException(segundos);
		}
	}

	public synchronized void registrarFallo(String ip, String email) {
		Instant ahora = clock.instant();
		sumar(pares, clavePar(ip, email), maxFallosPar, ahora);
		sumar(ips, ip, maxFallosIp, ahora);
	}

	/** Reinicia el contador del par; el de la IP sigue (si no, un atacante con una cuenta propia lo borraría). */
	public synchronized void registrarExito(String ip, String email) {
		pares.remove(clavePar(ip, email));
	}

	// Para los tests.
	synchronized int entradasPares() {
		return pares.size();
	}

	synchronized int entradasIps() {
		return ips.size();
	}

	private void sumar(Map<String, Contador> mapa, String clave, int umbral, Instant ahora) {
		Contador c = mapa.get(clave);
		if (c == null || vencido(c, ahora)) {
			c = new Contador();
			c.inicio = ahora;
			mapa.put(clave, c);
		}
		c.fallos++;
		if (c.fallos >= umbral) {
			c.bloqueadoHasta = ahora.plus(bloqueo);
		}
	}

	private Instant bloqueadoHasta(Contador c, Instant ahora) {
		return c != null && c.bloqueadoHasta != null && ahora.isBefore(c.bloqueadoHasta) ? c.bloqueadoHasta : null;
	}

	/** Un contador vence al terminar el bloqueo o, si nunca llegó a bloquear, al terminar la ventana. */
	private boolean vencido(Contador c, Instant ahora) {
		Instant fin = c.bloqueadoHasta != null ? c.bloqueadoHasta : c.inicio.plus(ventana);
		return !ahora.isBefore(fin);
	}

	private void limpiar(Instant ahora) {
		if (ahora.isBefore(ultimaLimpieza.plus(LIMPIEZA_CADA))) {
			return;
		}
		ultimaLimpieza = ahora;
		pares.values().removeIf(c -> vencido(c, ahora));
		ips.values().removeIf(c -> vencido(c, ahora));
	}

	private static String clavePar(String ip, String email) {
		return ip + "|" + email.trim().toLowerCase(Locale.ROOT);
	}
}
