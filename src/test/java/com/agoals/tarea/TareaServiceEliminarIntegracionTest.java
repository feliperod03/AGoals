package com.agoals.tarea;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

// TareaService.eliminar con el repository REAL contra el PostgreSQL de Docker (Flyway aplicado). Un test con mocks
// no detecta que la cascada ON DELETE de padre_id se lleve a las hijas: aquí sí. Cada test hace rollback al terminar
// (así se limpia lo que crea) y se verifica por ids propios, nunca por tamaño de lista.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TareaService.class)
class TareaServiceEliminarIntegracionTest {

	@Autowired
	TareaService service;

	@Autowired
	TareaRepository repository;

	@Autowired
	EntityManager em;

	private Tarea guardar(String titulo, Tarea padre) {
		Tarea t = new Tarea();
		t.setUsuarioId(TareaService.USUARIO_ID);
		t.setTitulo(titulo);
		t.setPadreId(padre == null ? null : padre.getId());
		return repository.saveAndFlush(t);
	}

	// Fuerza los SQL pendientes y vacía la caché para releer lo que de verdad quedó en la base.
	private void sincronizar() {
		em.flush();
		em.clear();
	}

	private boolean existe(Tarea t) {
		return repository.findById(t.getId()).isPresent();
	}

	private Long padreDe(Tarea t) {
		return repository.findById(t.getId()).orElseThrow().getPadreId();
	}

	@Test
	void conservarConPadreLasHijasSobrevivenYSubenAlAbuelo() {
		Tarea abuelo = guardar("abuelo", null);
		Tarea madre = guardar("madre", abuelo);
		Tarea hija1 = guardar("hija 1", madre);
		Tarea hija2 = guardar("hija 2", madre);
		Tarea nieta = guardar("nieta", hija1);
		sincronizar();

		service.eliminar(madre.getId(), ModoSubtareas.CONSERVAR);
		sincronizar();

		assertThat(existe(madre)).isFalse();
		assertThat(existe(hija1)).isTrue();
		assertThat(existe(hija2)).isTrue();
		assertThat(padreDe(hija1)).isEqualTo(abuelo.getId());
		assertThat(padreDe(hija2)).isEqualTo(abuelo.getId());
		assertThat(existe(nieta)).isTrue();
		assertThat(padreDe(nieta)).isEqualTo(hija1.getId());
		assertThat(existe(abuelo)).isTrue();
	}

	@Test
	void conservarSinPadreLasHijasSobrevivenYQuedanRaiz() {
		Tarea madre = guardar("madre", null);
		Tarea hija = guardar("hija", madre);
		Tarea nieta = guardar("nieta", hija);
		sincronizar();

		service.eliminar(madre.getId(), ModoSubtareas.CONSERVAR);
		sincronizar();

		assertThat(existe(madre)).isFalse();
		assertThat(existe(hija)).isTrue();
		assertThat(padreDe(hija)).isNull();
		assertThat(padreDe(nieta)).isEqualTo(hija.getId());
	}

	@Test
	void borrarUnArbolDeTresNivelesEliminaLaRamaCompletaYSoloEsa() {
		Tarea abuelo = guardar("abuelo", null);
		Tarea raiz = guardar("raiz", abuelo);
		Tarea hermana = guardar("hermana", abuelo);
		Tarea hija1 = guardar("hija 1", raiz);
		Tarea hija2 = guardar("hija 2", raiz);
		Tarea nieta = guardar("nieta", hija1);
		Tarea bisnieta = guardar("bisnieta", nieta);
		sincronizar();

		service.eliminar(raiz.getId(), ModoSubtareas.BORRAR);
		sincronizar();

		for (Tarea borrada : new Tarea[] { raiz, hija1, hija2, nieta, bisnieta }) {
			assertThat(existe(borrada)).as(borrada.getTitulo()).isFalse();
		}
		assertThat(existe(abuelo)).isTrue();
		assertThat(existe(hermana)).isTrue();
		assertThat(padreDe(hermana)).isEqualTo(abuelo.getId());
	}

	@Test
	void borrarArrastraElRecordatorioDeUnDescendiente() {
		Tarea raiz = guardar("raiz", null);
		Tarea hija = guardar("hija", raiz);
		em.createNativeQuery("insert into recordatorio (usuario_id, tarea_id, fecha_hora) values (1, :tarea, now())")
				.setParameter("tarea", hija.getId())
				.executeUpdate();
		sincronizar();

		service.eliminar(raiz.getId(), ModoSubtareas.BORRAR);
		sincronizar();

		Number restantes = (Number) em.createNativeQuery("select count(*) from recordatorio where tarea_id = :tarea")
				.setParameter("tarea", hija.getId())
				.getSingleResult();
		assertThat(restantes.intValue()).isZero();
	}

	@Test
	void sinModoYConSubtareasNoBorraNada() {
		Tarea madre = guardar("Estudiar", null);
		Tarea hija = guardar("hija", madre);
		sincronizar();

		org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.eliminar(madre.getId(), null))
				.isInstanceOf(TareaConDependenciasException.class)
				.hasMessageContaining("«Estudiar»");
		sincronizar();

		assertThat(existe(madre)).isTrue();
		assertThat(existe(hija)).isTrue();
	}
}
