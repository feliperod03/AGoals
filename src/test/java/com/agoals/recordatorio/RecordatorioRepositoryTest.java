package com.agoals.recordatorio;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Usa el PostgreSQL real de Docker (con Flyway aplicado). La base de tests es la de desarrollo y puede tener
// recordatorios reales del usuario 1: los de prueba van en 2098 y se comprueban por ids propios (contiene / no
// contiene), nunca por tamaño de lista. Cada test hace rollback al terminar.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class RecordatorioRepositoryTest {

	@Autowired
	RecordatorioRepository repository;

	@Autowired
	EntityManager em;

	private static OffsetDateTime t(String iso) {
		return OffsetDateTime.parse(iso);
	}

	// El módulo recordatorio no usa los repositories de tarea/evento (ni siquiera en los tests): SQL nativo.
	private Long tarea() {
		return ((Number) em.createNativeQuery(
				"INSERT INTO tarea (usuario_id, titulo) VALUES (1, 'smoke-rec') RETURNING id").getSingleResult())
				.longValue();
	}

	private Long evento() {
		return ((Number) em.createNativeQuery(
				"INSERT INTO evento (usuario_id, titulo, fecha_hora_inicio, fecha_hora_fin) "
						+ "VALUES (1, 'smoke-rec', '2098-01-01T10:00:00-03:00', '2098-01-01T11:00:00-03:00') RETURNING id")
				.getSingleResult()).longValue();
	}

	private Recordatorio guardar(Long tareaId, Long eventoId, String fechaHora, boolean enviado) {
		Recordatorio r = new Recordatorio();
		r.setUsuarioId(1L);
		r.setTareaId(tareaId);
		r.setEventoId(eventoId);
		r.setFechaHora(t(fechaHora));
		r.setEnviado(enviado);
		return repository.saveAndFlush(r);
	}

	private Recordatorio suelto(String fechaHora) {
		return guardar(null, null, fechaHora, false);
	}

	private static List<Long> ids(List<Recordatorio> rs) {
		return rs.stream().map(Recordatorio::getId).toList();
	}

	private static List<Long> propios(List<Recordatorio> rs, Recordatorio... mios) {
		Set<Long> mine = Set.of(java.util.Arrays.stream(mios).map(Recordatorio::getId).toArray(Long[]::new));
		return ids(rs).stream().filter(mine::contains).toList();
	}

	@Test
	void guardaYLeeConDefaultsDeLaBase() {
		Recordatorio r = new Recordatorio();
		r.setUsuarioId(1L);
		r.setFechaHora(t("2098-03-10T10:00:00-03:00"));
		repository.saveAndFlush(r);
		em.clear();

		Recordatorio leido = repository.findByIdAndUsuarioId(r.getId(), 1L).orElseThrow();
		assertThat(leido.getCanal()).isEqualTo(Canal.APP);
		assertThat(leido.isEnviado()).isFalse();
		assertThat(leido.getDescripcion()).isEmpty();
		assertThat(leido.getTareaId()).isNull();
		assertThat(leido.getEventoId()).isNull();
		// Se comparan instantes: el desfase de lo leído depende de la zona de la JVM.
		assertThat(leido.getFechaHora().toInstant()).isEqualTo(t("2098-03-10T13:00:00Z").toInstant());
	}

	@Test
	void guardaTareaEventoYCanal() {
		Long tarea = tarea();
		Long evento = evento();
		Recordatorio deTarea = guardar(tarea, null, "2098-03-10T10:00:00-03:00", false);
		Recordatorio deEvento = guardar(null, evento, "2098-03-10T10:00:00-03:00", true);
		em.clear();

		Recordatorio a = repository.findByIdAndUsuarioId(deTarea.getId(), 1L).orElseThrow();
		Recordatorio b = repository.findByIdAndUsuarioId(deEvento.getId(), 1L).orElseThrow();
		assertThat(a.getTareaId()).isEqualTo(tarea);
		assertThat(a.getEventoId()).isNull();
		assertThat(b.getEventoId()).isEqualTo(evento);
		assertThat(b.isEnviado()).isTrue();
	}

	@Test
	void noEncuentraRecordatoriosDeOtroUsuario() {
		Recordatorio r = suelto("2098-03-10T10:00:00-03:00");

		assertThat(repository.findByIdAndUsuarioId(r.getId(), 2L)).isEmpty();
		assertThat(repository.findByUsuarioIdOrderByFechaHoraAscIdAsc(2L)).isEmpty();
		assertThat(repository.findByUsuarioIdAndEnviadoFalseAndFechaHoraLessThanEqualOrderByFechaHoraAscIdAsc(
				2L, t("2099-01-01T00:00:00-03:00"))).isEmpty();
		assertThat(ids(repository.findByUsuarioIdOrderByFechaHoraAscIdAsc(1L))).contains(r.getId());
	}

	@Test
	void ordenaPorFechaHoraAscendenteYLuegoPorId() {
		Recordatorio tarde = suelto("2098-06-01T15:00:00-03:00");
		Recordatorio igual1 = suelto("2098-06-01T09:00:00-03:00");
		Recordatorio igual2 = suelto("2098-06-01T09:00:00-03:00");
		Recordatorio temprano = suelto("2098-06-01T08:00:00-03:00");

		List<Long> orden = propios(repository.findByUsuarioIdOrderByFechaHoraAscIdAsc(1L), tarde, igual1, igual2, temprano);

		assertThat(orden).containsExactly(temprano.getId(), igual1.getId(), igual2.getId(), tarde.getId());
		assertThat(igual2.getId()).isGreaterThan(igual1.getId());
	}

	@Test
	void vencidosRespetaLosBordesYExcluyeLosEnviados() {
		OffsetDateTime ahora = t("2098-05-01T12:00:00-03:00");
		Recordatorio antes = guardar(null, null, "2098-05-01T11:00:00-03:00", false);
		Recordatorio justoAhora = guardar(null, null, "2098-05-01T12:00:00-03:00", false);
		Recordatorio unInstanteDespues = guardar(null, null, "2098-05-01T12:00:00.001-03:00", false);
		Recordatorio enviado = guardar(null, null, "2098-05-01T10:00:00-03:00", true);
		Recordatorio futuro = guardar(null, null, "2098-05-02T12:00:00-03:00", false);

		List<Recordatorio> vencidos =
				repository.findByUsuarioIdAndEnviadoFalseAndFechaHoraLessThanEqualOrderByFechaHoraAscIdAsc(1L, ahora);

		assertThat(ids(vencidos)).contains(antes.getId(), justoAhora.getId())
				.doesNotContain(unInstanteDespues.getId(), enviado.getId(), futuro.getId());
		assertThat(propios(vencidos, antes, justoAhora)).containsExactly(antes.getId(), justoAhora.getId());
	}

	@Test
	void vencidosCompararInstantesAunqueElDesfaseSeaOtro() {
		Recordatorio r = guardar(null, null, "2098-05-01T12:00:00-03:00", false); // = 15:00Z

		assertThat(ids(repository.findByUsuarioIdAndEnviadoFalseAndFechaHoraLessThanEqualOrderByFechaHoraAscIdAsc(
				1L, t("2098-05-01T15:00:00Z")))).contains(r.getId());
		assertThat(ids(repository.findByUsuarioIdAndEnviadoFalseAndFechaHoraLessThanEqualOrderByFechaHoraAscIdAsc(
				1L, t("2098-05-01T14:59:59Z")))).doesNotContain(r.getId());
	}

	@Test
	void existsPorTareaYPorEventoRespetaAlUsuario() {
		Long tarea = tarea();
		Long evento = evento();
		guardar(tarea, null, "2098-03-10T10:00:00-03:00", false);
		guardar(null, evento, "2098-03-10T10:00:00-03:00", false);

		assertThat(repository.existsByTareaIdAndUsuarioId(tarea, 1L)).isTrue();
		assertThat(repository.existsByTareaIdAndUsuarioId(tarea, 2L)).isFalse();
		assertThat(repository.existsByTareaIdAndUsuarioId(999_999L, 1L)).isFalse();
		assertThat(repository.existsByEventoIdAndUsuarioId(evento, 1L)).isTrue();
		assertThat(repository.existsByEventoIdAndUsuarioId(evento, 2L)).isFalse();
		assertThat(repository.existsByEventoIdAndUsuarioId(999_999L, 1L)).isFalse();
	}

	@Test
	void laBaseRechazaDosRecordatoriosParaLaMismaTarea() {
		Long tarea = tarea();
		guardar(tarea, null, "2098-03-10T10:00:00-03:00", false);

		assertThatThrownBy(() -> guardar(tarea, null, "2098-03-11T10:00:00-03:00", false))
				.isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaDosRecordatoriosParaElMismoEvento() {
		Long evento = evento();
		guardar(null, evento, "2098-03-10T10:00:00-03:00", false);

		assertThatThrownBy(() -> guardar(null, evento, "2098-03-11T10:00:00-03:00", false))
				.isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaUnRecordatorioDeTareaYEventoALaVez() {
		Long tarea = tarea();
		Long evento = evento();

		assertThatThrownBy(() -> guardar(tarea, evento, "2098-03-10T10:00:00-03:00", false))
				.isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaUnaTareaInexistente() {
		assertThatThrownBy(() -> guardar(999_999L, null, "2098-03-10T10:00:00-03:00", false))
				.isInstanceOf(Exception.class);
	}

	@Test
	void borrarLaTareaBorraSuRecordatorioEnCascada() {
		Long tarea = tarea();
		Recordatorio r = guardar(tarea, null, "2098-03-10T10:00:00-03:00", false);
		em.clear();

		em.createNativeQuery("DELETE FROM tarea WHERE id = :id").setParameter("id", tarea).executeUpdate();
		em.clear();

		assertThat(repository.findByIdAndUsuarioId(r.getId(), 1L)).isEmpty();
	}

	@Test
	void borrarElEventoBorraSuRecordatorioEnCascada() {
		Long evento = evento();
		Recordatorio r = guardar(null, evento, "2098-03-10T10:00:00-03:00", false);
		em.clear();

		em.createNativeQuery("DELETE FROM evento WHERE id = :id").setParameter("id", evento).executeUpdate();
		em.clear();

		assertThat(repository.findByIdAndUsuarioId(r.getId(), 1L)).isEmpty();
	}
}
