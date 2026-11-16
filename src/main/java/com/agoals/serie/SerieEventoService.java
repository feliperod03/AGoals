package com.agoals.serie;

import com.agoals.evento.EventoService;
import com.agoals.evento.dto.EventoDeSerie;
import com.agoals.evento.dto.EventoResponse;
import com.agoals.recordatorio.RecordatorioService;
import com.agoals.recordatorio.dto.RecordatorioDeEvento;
import com.agoals.serie.GeneradorOcurrencias.Ocurrencia;
import com.agoals.serie.GeneradorOcurrencias.Regla;
import com.agoals.serie.dto.RecordatorioSerieRequest;
import com.agoals.serie.dto.SerieEventoCreadaResponse;
import com.agoals.serie.dto.SerieEventoEdicionRequest;
import com.agoals.serie.dto.SerieEventoEdicionResponse;
import com.agoals.serie.dto.SerieEventoRequest;
import com.agoals.serie.dto.SerieEventoResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;

/**
 * Orquesta series de eventos recurrentes. Depende de EventoService y RecordatorioService (nunca al revés), así que
 * evento y recordatorio no conocen a serie y no hay ciclos. Todo corre en una sola transacción: o se crea todo o nada.
 */
@Service
@Transactional
public class SerieEventoService {

	// La v1 no tiene login: todo pertenece al usuario creado en V2.
	static final Long USUARIO_ID = 1L;

	private final SerieEventoRepository repository;
	private final EventoService eventoService;
	private final RecordatorioService recordatorioService;

	public SerieEventoService(SerieEventoRepository repository, EventoService eventoService,
			RecordatorioService recordatorioService) {
		this.repository = repository;
		this.eventoService = eventoService;
		this.recordatorioService = recordatorioService;
	}

	public SerieEventoCreadaResponse crear(SerieEventoRequest r) {
		// Toda la validación y la generación completa van ANTES de escribir nada.
		ZoneId zona = GeneradorOcurrencias.zona(r.zonaHoraria());
		Regla regla = validarRegla(r);
		validarMinutos(r.recordatorio());
		List<Ocurrencia> ocurrencias = GeneradorOcurrencias.generar(regla, r.horaInicio(), r.horaFin(), zona, r.ahora());

		SerieEvento serie = new SerieEvento();
		serie.setUsuarioId(USUARIO_ID);
		serie.setFrecuencia(regla.frecuencia());
		serie.setDiasSemana(regla.frecuencia() == Frecuencia.SEMANAL ? EnumSet.copyOf(regla.dias()) : null);
		serie.setIntervaloSemanas(regla.frecuencia() == Frecuencia.SEMANAL ? regla.intervaloSemanas() : null);
		serie.setDiaMes(regla.diaMes());
		serie.setFechaInicio(ocurrencias.get(0).fecha());
		serie.setHasta(regla.hasta());
		serie.setRepeticiones(regla.repeticiones());
		serie.setZonaHoraria(r.zonaHoraria());
		serie = repository.saveAndFlush(serie);

		String descripcion = r.descripcion() != null ? r.descripcion() : "";
		List<EventoDeSerie> datos = ocurrencias.stream()
				.map(o -> new EventoDeSerie(r.titulo(), descripcion, o.inicio(), o.fin(), r.prioridad()))
				.toList();
		List<EventoResponse> eventos = eventoService.crearDeSerie(serie.getId(), datos);

		int creados = 0;
		int omitidos = 0;
		if (r.recordatorio() != null) {
			List<RecordatorioDeEvento> pedidos = new ArrayList<>();
			for (int i = 0; i < ocurrencias.size(); i++) {
				var instante = GeneradorOcurrencias.instanteRecordatorio(ocurrencias.get(i).inicio(),
						r.recordatorio().minutos(), r.ahora());
				if (instante == null) {
					omitidos++;
				} else {
					pedidos.add(new RecordatorioDeEvento(eventos.get(i).id(), instante));
				}
			}
			creados = pedidos.size();
			recordatorioService.sincronizarDeEventos(pedidos);
		}
		return new SerieEventoCreadaResponse(aRespuesta(serie), eventos, creados, omitidos);
	}

	@Transactional(readOnly = true)
	public SerieEventoResponse obtener(Long id) {
		return aRespuesta(buscar(id));
	}

	/**
	 * "Toda la serie": la ocurrencia elegida y las siguientes (las anteriores no se tocan). Pisa también las que se
	 * editaron una por una, pero cada una conserva su fecha (día local actual). La regla no se puede cambiar.
	 * Recordatorios: sin recordatorio pedido se borran los pendientes; si el instante nuevo ya pasó, el pendiente
	 * existente no se toca y cuenta como omitido; los ya enviados nunca se tocan.
	 */
	public SerieEventoEdicionResponse editarDesde(Long eventoId, SerieEventoEdicionRequest r) {
		EventoResponse elegido = eventoService.obtener(eventoId);
		SerieEvento serie = serieDe(elegido);
		ZoneId zona = GeneradorOcurrencias.zona(serie.getZonaHoraria());
		GeneradorOcurrencias.validarHoras(r.horaInicio(), r.horaFin());
		validarMinutos(r.recordatorio());

		String descripcion = r.descripcion() != null ? r.descripcion() : "";
		List<EventoResponse> modificados = new ArrayList<>();
		List<RecordatorioDeEvento> pedidos = new ArrayList<>();
		int omitidos = 0;
		for (EventoResponse o : eventoService.ocurrenciasDeSerieDesde(serie.getId(), elegido.fechaHoraInicio())) {
			LocalDate dia = o.fechaHoraInicio().atZoneSameInstant(zona).toLocalDate();
			Ocurrencia nueva = GeneradorOcurrencias.tramo(dia, r.horaInicio(), r.horaFin(), zona);
			modificados.add(eventoService.actualizarDeSerie(o.id(),
					new EventoDeSerie(r.titulo(), descripcion, nueva.inicio(), nueva.fin(), r.prioridad())));
			if (r.recordatorio() == null) {
				pedidos.add(new RecordatorioDeEvento(o.id(), null));
			} else {
				var instante = GeneradorOcurrencias.instanteRecordatorio(nueva.inicio(), r.recordatorio().minutos(), r.ahora());
				if (instante == null) {
					omitidos++;
				} else {
					pedidos.add(new RecordatorioDeEvento(o.id(), instante));
				}
			}
		}
		recordatorioService.sincronizarDeEventos(pedidos);
		return new SerieEventoEdicionResponse(modificados, omitidos);
	}

	/**
	 * Borra la ocurrencia elegida y las siguientes (los recordatorios, en cascada en la base). Si no queda ninguna, borra
	 * la serie; si quedan anteriores, la recorta: hasta = max(fechaInicio, día anterior), sin repeticiones. El max evita
	 * violar CHECK (hasta >= fecha_inicio) si una ocurrencia se movió con "solo este" a antes de fecha_inicio.
	 */
	public void eliminarDesde(Long eventoId) {
		EventoResponse elegido = eventoService.obtener(eventoId);
		SerieEvento serie = serieDe(elegido);
		eventoService.eliminarDeSerieDesde(serie.getId(), elegido.fechaHoraInicio());
		if (!eventoService.existenDeSerie(serie.getId())) {
			repository.delete(serie);
			return;
		}
		LocalDate diaAnterior = elegido.fechaHoraInicio().atZoneSameInstant(ZoneId.of(serie.getZonaHoraria()))
				.toLocalDate().minusDays(1);
		serie.setHasta(diaAnterior.isBefore(serie.getFechaInicio()) ? serie.getFechaInicio() : diaAnterior);
		serie.setRepeticiones(null);
		repository.saveAndFlush(serie);
	}

	// ---- Validación ----

	private Regla validarRegla(SerieEventoRequest r) {
		if (r.frecuencia() == Frecuencia.SEMANAL) {
			if (r.diasSemana() == null || r.diasSemana().isEmpty()) {
				throw new SerieEventoInvalidaException("Una serie semanal necesita al menos un día de la semana");
			}
			if (r.diaMes() != null) {
				throw new SerieEventoInvalidaException("'diaMes' solo vale en una serie mensual");
			}
			int intervalo = r.intervaloSemanas() != null ? r.intervaloSemanas() : 1;
			if (intervalo != 1 && intervalo != 2) {
				throw new SerieEventoInvalidaException("'intervaloSemanas' debe ser 1 o 2");
			}
			return conFinal(r, new Regla(Frecuencia.SEMANAL, EnumSet.copyOf(r.diasSemana()), intervalo, null, null, null));
		}
		if (r.diaMes() == null) {
			throw new SerieEventoInvalidaException("Una serie mensual necesita 'diaMes'");
		}
		if (r.diaMes() < 1 || r.diaMes() > 31) {
			throw new SerieEventoInvalidaException("'diaMes' debe estar entre 1 y 31");
		}
		if ((r.diasSemana() != null && !r.diasSemana().isEmpty()) || r.intervaloSemanas() != null) {
			throw new SerieEventoInvalidaException("'diasSemana' e 'intervaloSemanas' solo valen en una serie semanal");
		}
		return conFinal(r, new Regla(Frecuencia.MENSUAL, null, 1, r.diaMes(), null, null));
	}

	private Regla conFinal(SerieEventoRequest r, Regla base) {
		if ((r.hasta() == null) == (r.repeticiones() == null)) {
			throw new SerieEventoInvalidaException("Indica un final: 'hasta' o 'repeticiones', no ambos");
		}
		if (r.repeticiones() != null
				&& (r.repeticiones() < 1 || r.repeticiones() > GeneradorOcurrencias.TOPE)) {
			throw new SerieEventoInvalidaException(
					"'repeticiones' debe estar entre 1 y " + GeneradorOcurrencias.TOPE);
		}
		return new Regla(base.frecuencia(), base.dias(), base.intervaloSemanas(), base.diaMes(), r.hasta(),
				r.repeticiones());
	}

	private void validarMinutos(RecordatorioSerieRequest rec) {
		if (rec != null && (rec.minutos() < 0 || rec.minutos() > 10080)) {
			throw new SerieEventoInvalidaException("'minutosAntes' debe estar entre 0 y 10080");
		}
	}

	private SerieEvento serieDe(EventoResponse evento) {
		if (evento.serieId() == null) {
			throw new SerieEventoConflictoException(
					"El evento " + evento.id() + " no pertenece a una serie: usa la edición normal");
		}
		return buscar(evento.serieId());
	}

	private SerieEvento buscar(Long id) {
		return repository.findByIdAndUsuarioId(id, USUARIO_ID)
				.orElseThrow(() -> new SerieEventoNoEncontradaException(id));
	}

	private SerieEventoResponse aRespuesta(SerieEvento s) {
		return new SerieEventoResponse(s.getId(), s.getFrecuencia(), s.getDiasSemana(), s.getIntervaloSemanas(),
				s.getDiaMes(), s.getFechaInicio(), s.getHasta(), s.getRepeticiones(), s.getZonaHoraria());
	}
}
