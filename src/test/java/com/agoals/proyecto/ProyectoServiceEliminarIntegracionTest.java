package com.agoals.proyecto;

import com.agoals.common.Estado;
import com.agoals.common.ModoBorrado;
import com.agoals.idea.Idea;
import com.agoals.idea.IdeaRepository;
import com.agoals.idea.IdeaService;
import com.agoals.objetivo.ObjetivoConsultaService;
import com.agoals.tarea.Tarea;
import com.agoals.tarea.TareaRepository;
import com.agoals.tarea.TareaService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// ProyectoService.eliminar con los repositories REALES contra el PostgreSQL de Docker (Flyway aplicado). Un test con
// mocks no detecta que la cascada ON DELETE de padre_id se lleve a los hijos, ni que el SET NULL suelte tareas e ideas
// antes de que las encontremos: aquí sí. Cada test hace rollback al terminar (así se limpia lo que crea) y se verifica
// por ids propios, nunca por tamaño de lista.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({ ProyectoService.class, TareaService.class, IdeaService.class, ObjetivoConsultaService.class,
		ProyectoConsultaService.class })
class ProyectoServiceEliminarIntegracionTest {

	private static final Long U = 1L;
	private static final ModoBorrado BORRAR = ModoBorrado.BORRAR;
	private static final ModoBorrado CONSERVAR = ModoBorrado.CONSERVAR;

	@Autowired
	ProyectoService service;

	@Autowired
	ProyectoRepository repository;

	@Autowired
	TareaRepository tareaRepository;

	@Autowired
	IdeaRepository ideaRepository;

	@Autowired
	EntityManager em;

	private Proyecto proyecto(String nombre, Proyecto padre) {
		Proyecto p = new Proyecto();
		p.setUsuarioId(U);
		p.setNombre(nombre);
		p.setPadreId(padre == null ? null : padre.getId());
		return repository.saveAndFlush(p);
	}

	private Tarea tarea(String titulo, Tarea padre, Long proyectoId) {
		Tarea t = new Tarea();
		t.setUsuarioId(U);
		t.setTitulo(titulo);
		t.setPadreId(padre == null ? null : padre.getId());
		t.setProyectoId(proyectoId);
		return tareaRepository.saveAndFlush(t);
	}

	private Idea idea(String titulo, Long proyectoId) {
		Idea i = new Idea();
		i.setUsuarioId(U);
		i.setTitulo(titulo);
		i.setProyectoId(proyectoId);
		return ideaRepository.saveAndFlush(i);
	}

	private void recordatorioDe(Tarea t) {
		em.createNativeQuery("insert into recordatorio (usuario_id, tarea_id, fecha_hora) values (1, :tarea, now())")
				.setParameter("tarea", t.getId())
				.executeUpdate();
	}

	// Fuerza los SQL pendientes y vacía la caché para releer lo que de verdad quedó en la base.
	private void sincronizar() {
		em.flush();
		em.clear();
	}

	private static EleccionesBorradoProyecto elige(ModoBorrado subproyectos, ModoBorrado tareas, ModoBorrado ideas) {
		return new EleccionesBorradoProyecto(subproyectos, tareas, ideas);
	}

	private boolean existe(Proyecto p) {
		return repository.findById(p.getId()).isPresent();
	}

	private boolean existe(Tarea t) {
		return tareaRepository.findById(t.getId()).isPresent();
	}

	private boolean existe(Idea i) {
		return ideaRepository.findById(i.getId()).isPresent();
	}

	private Long padreDe(Proyecto p) {
		return repository.findById(p.getId()).orElseThrow().getPadreId();
	}

	private Long proyectoDe(Tarea t) {
		return tareaRepository.findById(t.getId()).orElseThrow().getProyectoId();
	}

	private int recordatoriosDe(Tarea t) {
		return ((Number) em.createNativeQuery("select count(*) from recordatorio where tarea_id = :tarea")
				.setParameter("tarea", t.getId())
				.getSingleResult()).intValue();
	}

	// ---- Subproyectos ----

	@Test
	void conservarSubproyectosConAbueloLosHijosSobrevivenYSubenAlAbuelo() {
		Proyecto abuelo = proyecto("abuelo", null);
		Proyecto madre = proyecto("madre", abuelo);
		Proyecto hija1 = proyecto("hija 1", madre);
		Proyecto hija2 = proyecto("hija 2", madre);
		Proyecto nieta = proyecto("nieta", hija1);
		sincronizar();

		service.eliminar(madre.getId(), elige(CONSERVAR, null, null));
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
	void conservarSubproyectosSinPadreLosHijosQuedanRaizYSusDescendientesLosAcompanan() {
		Proyecto madre = proyecto("madre", null);
		Proyecto hija = proyecto("hija", madre);
		Proyecto nieta = proyecto("nieta", hija);
		sincronizar();

		service.eliminar(madre.getId(), elige(CONSERVAR, null, null));
		sincronizar();

		assertThat(existe(madre)).isFalse();
		assertThat(existe(hija)).isTrue();
		assertThat(padreDe(hija)).isNull();
		assertThat(padreDe(nieta)).isEqualTo(hija.getId());
	}

	@Test
	void borrarSubproyectosEliminaLaRamaCompletaYSoloEsa() {
		Proyecto abuelo = proyecto("abuelo", null);
		Proyecto raiz = proyecto("raiz", abuelo);
		Proyecto hermano = proyecto("hermano", abuelo);
		Proyecto hija1 = proyecto("hija 1", raiz);
		Proyecto hija2 = proyecto("hija 2", raiz);
		Proyecto nieta = proyecto("nieta", hija1);
		Proyecto bisnieta = proyecto("bisnieta", nieta);
		sincronizar();

		service.eliminar(raiz.getId(), elige(BORRAR, null, null));
		sincronizar();

		for (Proyecto borrado : new Proyecto[] { raiz, hija1, hija2, nieta, bisnieta }) {
			assertThat(existe(borrado)).as(borrado.getNombre()).isFalse();
		}
		assertThat(existe(abuelo)).isTrue();
		assertThat(existe(hermano)).isTrue();
		assertThat(padreDe(hermano)).isEqualTo(abuelo.getId());
	}

	@Test
	void unProyectoSinDependenciasSeBorraSinElecciones() {
		Proyecto p = proyecto("solo", null);
		sincronizar();

		service.eliminar(p.getId(), EleccionesBorradoProyecto.NINGUNA);
		sincronizar();

		assertThat(existe(p)).isFalse();
	}

	@Test
	void unaEleccionSobreUnaCategoriaSinElementosSeIgnora() {
		Proyecto p = proyecto("solo", null);
		sincronizar();

		service.eliminar(p.getId(), elige(BORRAR, BORRAR, CONSERVAR));
		sincronizar();

		assertThat(existe(p)).isFalse();
	}

	// ---- Tareas ----

	@Test
	void tareasBorrarEliminaLaTareaLigadaConTodasSusSubtareasNoLigadasYSuRecordatorio() {
		Proyecto p = proyecto("p", null);
		Tarea ligada = tarea("ligada", null, p.getId());
		Tarea hija = tarea("hija no ligada", ligada, null);
		Tarea nieta = tarea("nieta no ligada", hija, null);
		Tarea ajena = tarea("ajena", null, null);
		recordatorioDe(nieta);
		sincronizar();

		service.eliminar(p.getId(), elige(null, BORRAR, null));
		sincronizar();

		assertThat(existe(p)).isFalse();
		assertThat(existe(ligada)).isFalse();
		assertThat(existe(hija)).isFalse();
		assertThat(existe(nieta)).isFalse();
		assertThat(recordatoriosDe(nieta)).isZero();
		assertThat(existe(ajena)).isTrue();
	}

	@Test
	void tareasBorrarConUnaLigadaDentroDeOtraLigadaNoFallaPorLaCascada() {
		// Si la madre se borrara primero, la cascada de la base se llevaría a la hija y su DELETE fallaría.
		Proyecto p = proyecto("p", null);
		Tarea madre = tarea("madre ligada", null, p.getId());
		Tarea hija = tarea("hija ligada", madre, p.getId());
		Tarea nieta = tarea("nieta", hija, null);
		sincronizar();

		service.eliminar(p.getId(), elige(null, BORRAR, null));
		sincronizar();

		assertThat(existe(madre)).isFalse();
		assertThat(existe(hija)).isFalse();
		assertThat(existe(nieta)).isFalse();
	}

	@Test
	void tareasBorrarTambienBorraLaSubtareaLigadaAOtroProyecto() {
		// Regla acordada: se borra la tarea ligada CON TODAS sus subtareas, estén ligadas a este proyecto o a otro.
		Proyecto p = proyecto("p", null);
		Proyecto otro = proyecto("otro", null);
		Tarea ligada = tarea("ligada", null, p.getId());
		Tarea hijaDeOtro = tarea("hija de otro proyecto", ligada, otro.getId());
		sincronizar();

		service.eliminar(p.getId(), elige(null, BORRAR, null));
		sincronizar();

		assertThat(existe(ligada)).isFalse();
		assertThat(existe(hijaDeOtro)).isFalse();
		assertThat(existe(otro)).isTrue();
	}

	@Test
	void tareasConservarSoloPonenElProyectoANullYNoTocanNadaMas() {
		Proyecto p = proyecto("p", null);
		Tarea madre = tarea("madre", null, null);
		Tarea ligada = tarea("ligada", madre, p.getId());
		Tarea hija = tarea("hija de la ligada", ligada, null);
		ligada.setFecha(LocalDate.of(2026, 11, 20));
		ligada.setEstado(Estado.EN_PROGRESO);
		tareaRepository.saveAndFlush(ligada);
		recordatorioDe(ligada);
		sincronizar();

		service.eliminar(p.getId(), elige(null, CONSERVAR, null));
		sincronizar();

		assertThat(existe(p)).isFalse();
		Tarea leida = tareaRepository.findById(ligada.getId()).orElseThrow();
		assertThat(leida.getProyectoId()).isNull();
		assertThat(leida.getPadreId()).isEqualTo(madre.getId());
		assertThat(leida.getFecha()).isEqualTo(LocalDate.of(2026, 11, 20));
		assertThat(leida.getEstado()).isEqualTo(Estado.EN_PROGRESO);
		assertThat(existe(hija)).isTrue();
		assertThat(recordatoriosDe(ligada)).isEqualTo(1);
	}

	@Test
	void tareasConservarNoLasPierdeAunqueElProyectoSeaBorradoYSuBaseHagaSetNull() {
		Proyecto p = proyecto("p", null);
		Tarea t = tarea("t", null, p.getId());
		sincronizar();

		service.eliminar(p.getId(), elige(null, CONSERVAR, null));
		sincronizar();

		assertThat(existe(t)).isTrue();
		assertThat(proyectoDe(t)).isNull();
	}

	// ---- Ideas ----

	@Test
	void ideasBorrarLasEliminaYNoTocaLasAjenas() {
		Proyecto p = proyecto("p", null);
		Idea delProyecto = idea("del proyecto", p.getId());
		Idea libre = idea("libre", null);
		sincronizar();

		service.eliminar(p.getId(), elige(null, null, BORRAR));
		sincronizar();

		assertThat(existe(delProyecto)).isFalse();
		assertThat(existe(libre)).isTrue();
	}

	@Test
	void ideasConservarLasDejaLibres() {
		Proyecto p = proyecto("p", null);
		Idea i = idea("del proyecto", p.getId());
		sincronizar();

		service.eliminar(p.getId(), elige(null, null, CONSERVAR));
		sincronizar();

		assertThat(existe(p)).isFalse();
		Idea leida = ideaRepository.findById(i.getId()).orElseThrow();
		assertThat(leida.getProyectoId()).isNull();
		assertThat(leida.getObjetivoId()).isNull();
	}

	// ---- 409: nada se borra a medias ----

	@Test
	void subproyectosSinEleccionDa409ConElNombreYNoBorraNada() {
		Proyecto casa = proyecto("Casa", null);
		Proyecto hijo = proyecto("hijo", casa);
		sincronizar();

		assertThatThrownBy(() -> service.eliminar(casa.getId(), elige(null, BORRAR, BORRAR)))
				.isInstanceOf(ProyectoConDependenciasException.class)
				.hasMessage("El proyecto «Casa» tiene subproyectos: indica si quieres borrarlos o conservarlos");
		sincronizar();

		assertThat(existe(casa)).isTrue();
		assertThat(existe(hijo)).isTrue();
		assertThat(padreDe(hijo)).isEqualTo(casa.getId());
	}

	@Test
	void tareaSoloEnUnSubproyectoSinEleccionDeTareasDa409YNoBorraNada() {
		// subproyectos=borrar amplía el alcance: la tarea del subproyecto cuenta y falta decidir qué hacer con ella.
		Proyecto casa = proyecto("Casa", null);
		Proyecto hijo = proyecto("hijo", casa);
		Tarea t = tarea("t del hijo", null, hijo.getId());
		Idea i = idea("idea del padre", casa.getId());
		sincronizar();

		assertThatThrownBy(() -> service.eliminar(casa.getId(), elige(BORRAR, null, BORRAR)))
				.isInstanceOf(ProyectoConDependenciasException.class)
				.hasMessage("El proyecto «Casa» tiene tareas: indica si quieres borrarlas o conservarlas");
		sincronizar();

		assertThat(existe(casa)).isTrue();
		assertThat(existe(hijo)).isTrue();
		assertThat(existe(t)).isTrue();
		assertThat(proyectoDe(t)).isEqualTo(hijo.getId());
		assertThat(existe(i)).isTrue(); // las ideas ya elegidas tampoco se tocaron
	}

	@Test
	void conSubproyectosConservarLaTareaDelHijoNoCuentaEnElAlcance() {
		// Solo se mira el propio proyecto: el hijo se conserva con sus tareas, así que no hace falta elegir.
		Proyecto casa = proyecto("Casa", null);
		Proyecto hijo = proyecto("hijo", casa);
		Tarea delHijo = tarea("t del hijo", null, hijo.getId());
		sincronizar();

		service.eliminar(casa.getId(), elige(CONSERVAR, null, null));
		sincronizar();

		assertThat(existe(casa)).isFalse();
		assertThat(existe(hijo)).isTrue();
		assertThat(proyectoDe(delHijo)).isEqualTo(hijo.getId());
	}

	@Test
	void ideasSinEleccionDa409ConElNombreYNoBorraNada() {
		Proyecto casa = proyecto("Casa", null);
		Tarea t = tarea("t", null, casa.getId());
		Idea i = idea("i", casa.getId());
		sincronizar();

		assertThatThrownBy(() -> service.eliminar(casa.getId(), elige(null, BORRAR, null)))
				.isInstanceOf(ProyectoConDependenciasException.class)
				.hasMessage("El proyecto «Casa» tiene ideas: indica si quieres borrarlas o conservarlas");
		sincronizar();

		assertThat(existe(casa)).isTrue();
		assertThat(existe(t)).isTrue();
		assertThat(proyectoDe(t)).isEqualTo(casa.getId());
		assertThat(existe(i)).isTrue();
	}

	// ---- Elecciones mixtas ----

	@Test
	void eleccionesMixtasSubproyectosBorrarTareasConservarIdeasBorrar() {
		Proyecto raiz = proyecto("raiz", null);
		Proyecto hijo = proyecto("hijo", raiz);
		Proyecto nieto = proyecto("nieto", hijo);
		Tarea tDelHijo = tarea("t del hijo", null, hijo.getId());
		Tarea tDeLaRaiz = tarea("t de la raiz", null, raiz.getId());
		Idea iDelNieto = idea("i del nieto", nieto.getId());
		Idea iLibre = idea("libre", null);
		sincronizar();

		service.eliminar(raiz.getId(), elige(BORRAR, CONSERVAR, BORRAR));
		sincronizar();

		assertThat(existe(raiz)).isFalse();
		assertThat(existe(hijo)).isFalse();
		assertThat(existe(nieto)).isFalse();
		assertThat(existe(tDelHijo)).isTrue();
		assertThat(proyectoDe(tDelHijo)).isNull();
		assertThat(existe(tDeLaRaiz)).isTrue();
		assertThat(proyectoDe(tDeLaRaiz)).isNull();
		assertThat(existe(iDelNieto)).isFalse();
		assertThat(existe(iLibre)).isTrue();
	}

	@Test
	void eleccionesMixtasSubproyectosConservarTareasBorrarIdeasConservar() {
		Proyecto abuelo = proyecto("abuelo", null);
		Proyecto madre = proyecto("madre", abuelo);
		Proyecto hija = proyecto("hija", madre);
		Tarea tDeLaMadre = tarea("t de la madre", null, madre.getId());
		Tarea tDeLaHija = tarea("t de la hija", null, hija.getId());
		Idea iDeLaMadre = idea("i de la madre", madre.getId());
		sincronizar();

		service.eliminar(madre.getId(), elige(CONSERVAR, BORRAR, CONSERVAR));
		sincronizar();

		assertThat(existe(madre)).isFalse();
		assertThat(existe(hija)).isTrue();
		assertThat(padreDe(hija)).isEqualTo(abuelo.getId());
		assertThat(existe(tDeLaMadre)).isFalse();
		assertThat(existe(tDeLaHija)).isTrue(); // la hija se conserva, sus tareas no se tocan
		assertThat(proyectoDe(tDeLaHija)).isEqualTo(hija.getId());
		Idea idea = ideaRepository.findById(iDeLaMadre.getId()).orElseThrow();
		assertThat(idea.getProyectoId()).isNull();
	}
}
