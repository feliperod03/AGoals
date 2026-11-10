package com.agoals.objetivo;

import com.agoals.common.ModoBorrado;
import com.agoals.idea.Idea;
import com.agoals.idea.IdeaRepository;
import com.agoals.idea.IdeaService;
import com.agoals.proyecto.Proyecto;
import com.agoals.proyecto.ProyectoConsultaService;
import com.agoals.proyecto.ProyectoRepository;
import com.agoals.proyecto.ProyectoService;
import com.agoals.tarea.Tarea;
import com.agoals.tarea.TareaRepository;
import com.agoals.tarea.TareaService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// ObjetivoService.eliminar con los repositories REALES contra el PostgreSQL de Docker (Flyway aplicado). Cubre lo que
// los mocks no pueden: la cascada ON DELETE de padre_id (objetivos y proyectos), el SET NULL de objetivo_id /
// proyecto_id y el rescate de subproyectos. Cada test hace rollback al terminar y se verifica por ids propios.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({ ObjetivoService.class, ProyectoService.class, TareaService.class, IdeaService.class,
		ObjetivoConsultaService.class, ProyectoConsultaService.class })
class ObjetivoServiceEliminarIntegracionTest {

	private static final Long U = 1L;
	private static final ModoBorrado BORRAR = ModoBorrado.BORRAR;
	private static final ModoBorrado CONSERVAR = ModoBorrado.CONSERVAR;

	@Autowired
	ObjetivoService service;

	@Autowired
	ObjetivoRepository repository;

	@Autowired
	ProyectoRepository proyectoRepository;

	@Autowired
	TareaRepository tareaRepository;

	@Autowired
	IdeaRepository ideaRepository;

	@Autowired
	EntityManager em;

	private Objetivo objetivo(String nombre, Objetivo padre) {
		Objetivo o = new Objetivo();
		o.setUsuarioId(U);
		o.setNombre(nombre);
		o.setPadreId(padre == null ? null : padre.getId());
		return repository.saveAndFlush(o);
	}

	private Proyecto proyecto(String nombre, Proyecto padre, Objetivo objetivo) {
		Proyecto p = new Proyecto();
		p.setUsuarioId(U);
		p.setNombre(nombre);
		p.setPadreId(padre == null ? null : padre.getId());
		p.setObjetivoId(objetivo == null ? null : objetivo.getId());
		return proyectoRepository.saveAndFlush(p);
	}

	private Tarea tarea(String titulo, Tarea padre, Proyecto proyecto, Objetivo objetivo) {
		Tarea t = new Tarea();
		t.setUsuarioId(U);
		t.setTitulo(titulo);
		t.setPadreId(padre == null ? null : padre.getId());
		t.setProyectoId(proyecto == null ? null : proyecto.getId());
		t.setObjetivoId(objetivo == null ? null : objetivo.getId());
		return tareaRepository.saveAndFlush(t);
	}

	private Idea ideaDeProyecto(String titulo, Proyecto proyecto) {
		Idea i = new Idea();
		i.setUsuarioId(U);
		i.setTitulo(titulo);
		i.setProyectoId(proyecto.getId());
		return ideaRepository.saveAndFlush(i);
	}

	private Idea ideaDeObjetivo(String titulo, Objetivo objetivo) {
		Idea i = new Idea();
		i.setUsuarioId(U);
		i.setTitulo(titulo);
		i.setObjetivoId(objetivo == null ? null : objetivo.getId());
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

	private static EleccionesBorradoObjetivo elige(ModoBorrado subobjetivos, ModoBorrado proyectos, ModoBorrado tareas,
			ModoBorrado ideas) {
		return new EleccionesBorradoObjetivo(subobjetivos, proyectos, tareas, ideas);
	}

	private boolean existe(Objetivo o) {
		return repository.findById(o.getId()).isPresent();
	}

	private boolean existe(Proyecto p) {
		return proyectoRepository.findById(p.getId()).isPresent();
	}

	private boolean existe(Tarea t) {
		return tareaRepository.findById(t.getId()).isPresent();
	}

	private boolean existe(Idea i) {
		return ideaRepository.findById(i.getId()).isPresent();
	}

	private Long padreDe(Objetivo o) {
		return repository.findById(o.getId()).orElseThrow().getPadreId();
	}

	private Long padreDe(Proyecto p) {
		return proyectoRepository.findById(p.getId()).orElseThrow().getPadreId();
	}

	private Long objetivoDe(Proyecto p) {
		return proyectoRepository.findById(p.getId()).orElseThrow().getObjetivoId();
	}

	private Tarea leer(Tarea t) {
		return tareaRepository.findById(t.getId()).orElseThrow();
	}

	private int recordatoriosDe(Tarea t) {
		return ((Number) em.createNativeQuery("select count(*) from recordatorio where tarea_id = :tarea")
				.setParameter("tarea", t.getId())
				.getSingleResult()).intValue();
	}

	// ---- Subobjetivos ----

	@Test
	void conservarSubobjetivosConAbueloLosHijosSobrevivenYSubenAlAbuelo() {
		Objetivo abuelo = objetivo("abuelo", null);
		Objetivo madre = objetivo("madre", abuelo);
		Objetivo hija1 = objetivo("hija 1", madre);
		Objetivo hija2 = objetivo("hija 2", madre);
		Objetivo nieta = objetivo("nieta", hija1);
		sincronizar();

		service.eliminar(madre.getId(), elige(CONSERVAR, null, null, null));
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
	void conservarSubobjetivosSinPadreLosHijosQuedanRaizYSusDescendientesLosAcompanan() {
		Objetivo madre = objetivo("madre", null);
		Objetivo hija = objetivo("hija", madre);
		Objetivo nieta = objetivo("nieta", hija);
		sincronizar();

		service.eliminar(madre.getId(), elige(CONSERVAR, null, null, null));
		sincronizar();

		assertThat(existe(madre)).isFalse();
		assertThat(existe(hija)).isTrue();
		assertThat(padreDe(hija)).isNull();
		assertThat(padreDe(nieta)).isEqualTo(hija.getId());
	}

	@Test
	void borrarSubobjetivosEliminaLaRamaCompletaYSoloEsa() {
		Objetivo abuelo = objetivo("abuelo", null);
		Objetivo raiz = objetivo("raiz", abuelo);
		Objetivo hermano = objetivo("hermano", abuelo);
		Objetivo hija1 = objetivo("hija 1", raiz);
		Objetivo hija2 = objetivo("hija 2", raiz);
		Objetivo nieta = objetivo("nieta", hija1);
		Objetivo bisnieta = objetivo("bisnieta", nieta);
		sincronizar();

		service.eliminar(raiz.getId(), elige(BORRAR, null, null, null));
		sincronizar();

		for (Objetivo borrado : new Objetivo[] { raiz, hija1, hija2, nieta, bisnieta }) {
			assertThat(existe(borrado)).as(borrado.getNombre()).isFalse();
		}
		assertThat(existe(abuelo)).isTrue();
		assertThat(existe(hermano)).isTrue();
		assertThat(padreDe(hermano)).isEqualTo(abuelo.getId());
	}

	@Test
	void subobjetivosBorrarIncluyeLosProyectosTareasEIdeasDeLosSubobjetivos() {
		Objetivo raiz = objetivo("raiz", null);
		Objetivo sub = objetivo("sub", raiz);
		Proyecto pDelSub = proyecto("p del sub", null, sub);
		Tarea tDelSub = tarea("t del sub", null, null, sub);
		Idea iDelSub = ideaDeObjetivo("i del sub", sub);
		sincronizar();

		service.eliminar(raiz.getId(), elige(BORRAR, BORRAR, BORRAR, BORRAR));
		sincronizar();

		assertThat(existe(raiz)).isFalse();
		assertThat(existe(sub)).isFalse();
		assertThat(existe(pDelSub)).isFalse();
		assertThat(existe(tDelSub)).isFalse();
		assertThat(existe(iDelSub)).isFalse();
	}

	@Test
	void subobjetivosBorrarConProyectosConservarDesligaTambienLosDelSubobjetivo() {
		Objetivo raiz = objetivo("raiz", null);
		Objetivo sub = objetivo("sub", raiz);
		Proyecto pDelSub = proyecto("p del sub", null, sub);
		sincronizar();

		service.eliminar(raiz.getId(), elige(BORRAR, CONSERVAR, null, null));
		sincronizar();

		assertThat(existe(sub)).isFalse();
		assertThat(existe(pDelSub)).isTrue();
		assertThat(objetivoDe(pDelSub)).isNull();
	}

	@Test
	void unObjetivoSinDependenciasSeBorraSinElecciones() {
		Objetivo o = objetivo("solo", null);
		sincronizar();

		service.eliminar(o.getId(), EleccionesBorradoObjetivo.NINGUNA);
		sincronizar();

		assertThat(existe(o)).isFalse();
	}

	// ---- Proyectos del objetivo ----

	@Test
	void proyectosConservarLosDejaSinObjetivoConSusSubproyectosYTareasIntactos() {
		Objetivo o = objetivo("o", null);
		Proyecto p = proyecto("p", null, o);
		Proyecto sub = proyecto("sub de p", p, null);
		Tarea tDeP = tarea("t de p", null, p, null);
		sincronizar();

		service.eliminar(o.getId(), elige(null, CONSERVAR, null, null));
		sincronizar();

		assertThat(existe(o)).isFalse();
		assertThat(existe(p)).isTrue();
		assertThat(objetivoDe(p)).isNull();
		assertThat(existe(sub)).isTrue();
		assertThat(padreDe(sub)).isEqualTo(p.getId());
		assertThat(existe(tDeP)).isTrue(); // el proyecto se conserva: sus tareas no se tocan
		assertThat(leer(tDeP).getProyectoId()).isEqualTo(p.getId());
	}

	@Test
	void proyectosBorrarEliminaElProyectoYTodosSusSubproyectosYSusTareas() {
		Objetivo o = objetivo("o", null);
		Proyecto p = proyecto("p", null, o);
		Proyecto sinObjetivo = proyecto("sub sin objetivo", p, null);
		Proyecto delMismo = proyecto("sub del mismo objetivo", p, o);
		Proyecto nieto = proyecto("nieto", sinObjetivo, null);
		Tarea tDeP = tarea("t de p", null, p, null);
		Tarea tDelNieto = tarea("t del nieto", null, nieto, null);
		Proyecto ajeno = proyecto("ajeno", null, null);
		sincronizar();

		service.eliminar(o.getId(), elige(null, BORRAR, BORRAR, null));
		sincronizar();

		for (Proyecto borrado : new Proyecto[] { p, sinObjetivo, delMismo, nieto }) {
			assertThat(existe(borrado)).as(borrado.getNombre()).isFalse();
		}
		assertThat(existe(tDeP)).isFalse();
		assertThat(existe(tDelNieto)).isFalse();
		assertThat(existe(ajeno)).isTrue();
	}

	// ---- Rescate de subproyectos de otro objetivo ----

	@Test
	void unSubproyectoDeOtroObjetivoSeRescataConSuSubarbolYQuedaRaiz() {
		Objetivo o = objetivo("o", null);
		Objetivo otro = objetivo("otro", null);
		Proyecto p = proyecto("p", null, o);
		Proyecto rescatado = proyecto("rescatado", p, otro);
		Proyecto hijoDelRescatado = proyecto("hijo del rescatado", rescatado, null);
		Proyecto sinObjetivo = proyecto("hermano sin objetivo", p, null);
		sincronizar();

		service.eliminar(o.getId(), elige(null, BORRAR, null, null));
		sincronizar();

		assertThat(existe(p)).isFalse();
		assertThat(existe(sinObjetivo)).isFalse();
		assertThat(existe(rescatado)).isTrue();
		assertThat(padreDe(rescatado)).isNull();
		assertThat(objetivoDe(rescatado)).isEqualTo(otro.getId());
		assertThat(existe(hijoDelRescatado)).isTrue();
		assertThat(padreDe(hijoDelRescatado)).isEqualTo(rescatado.getId());
		assertThat(existe(otro)).isTrue();
	}

	@Test
	void dosRescatadosHermanosSobrevivenYQuedanRaiz() {
		Objetivo o = objetivo("o", null);
		Objetivo otro1 = objetivo("otro 1", null);
		Objetivo otro2 = objetivo("otro 2", null);
		Proyecto p = proyecto("p", null, o);
		Proyecto r1 = proyecto("rescatado 1", p, otro1);
		Proyecto r2 = proyecto("rescatado 2", p, otro2);
		Proyecto nieto1 = proyecto("nieto de r1", r1, null);
		sincronizar();

		service.eliminar(o.getId(), elige(null, BORRAR, null, null));
		sincronizar();

		assertThat(existe(p)).isFalse();
		assertThat(existe(r1)).isTrue();
		assertThat(existe(r2)).isTrue();
		assertThat(padreDe(r1)).isNull();
		assertThat(padreDe(r2)).isNull();
		assertThat(objetivoDe(r1)).isEqualTo(otro1.getId());
		assertThat(objetivoDe(r2)).isEqualTo(otro2.getId());
		assertThat(padreDe(nieto1)).isEqualTo(r1.getId());
	}

	@Test
	void unRescatadoVariosNivelesAbajoSubeAlAncestroSuperviviente() {
		// q (no se borra) -> p (objetivo o) -> s1 -> s2 -> rescatado (otro objetivo) -> hijo.
		// El rescatado debe colgar de q: ni de s2 (borrado) ni quedar raíz.
		Objetivo o = objetivo("o", null);
		Objetivo otro = objetivo("otro", null);
		Proyecto q = proyecto("q", null, null);
		Proyecto p = proyecto("p", q, o);
		Proyecto s1 = proyecto("s1", p, null);
		Proyecto s2 = proyecto("s2", s1, null);
		Proyecto rescatado = proyecto("rescatado", s2, otro);
		Proyecto hijo = proyecto("hijo del rescatado", rescatado, null);
		sincronizar();

		service.eliminar(o.getId(), elige(null, BORRAR, null, null));
		sincronizar();

		assertThat(existe(q)).isTrue();
		assertThat(existe(p)).isFalse();
		assertThat(existe(s1)).isFalse();
		assertThat(existe(s2)).isFalse();
		assertThat(existe(rescatado)).isTrue();
		assertThat(padreDe(rescatado)).isEqualTo(q.getId());
		assertThat(existe(hijo)).isTrue();
		assertThat(padreDe(hijo)).isEqualTo(rescatado.getId());
	}

	@Test
	void unProyectoLigadoDirectoQueCuelgaDeUnRescatadoSeBorraYElRescatadoQueda() {
		// p (objetivo o) -> rescatado (otro) -> ligado (objetivo o) -> hijo. ligado e hijo se borran; rescatado queda raíz.
		Objetivo o = objetivo("o", null);
		Objetivo otro = objetivo("otro", null);
		Proyecto p = proyecto("p", null, o);
		Proyecto rescatado = proyecto("rescatado", p, otro);
		Proyecto ligado = proyecto("ligado directo", rescatado, o);
		Proyecto hijoDelLigado = proyecto("hijo del ligado", ligado, null);
		sincronizar();

		service.eliminar(o.getId(), elige(null, BORRAR, null, null));
		sincronizar();

		assertThat(existe(p)).isFalse();
		assertThat(existe(ligado)).isFalse();
		assertThat(existe(hijoDelLigado)).isFalse();
		assertThat(existe(rescatado)).isTrue();
		assertThat(padreDe(rescatado)).isNull();
		assertThat(objetivoDe(rescatado)).isEqualTo(otro.getId());
	}

	@Test
	void elRescatadoConservaSusTareasAunqueSePidaBorrarLasTareas() {
		Objetivo o = objetivo("o", null);
		Objetivo otro = objetivo("otro", null);
		Proyecto p = proyecto("p", null, o);
		Proyecto rescatado = proyecto("rescatado", p, otro);
		Proyecto hijoDelRescatado = proyecto("hijo del rescatado", rescatado, null);
		Tarea tDeP = tarea("t de p", null, p, null);
		Tarea tDelRescatado = tarea("t del rescatado", null, rescatado, null);
		Tarea subDelRescatado = tarea("sub de t del rescatado", tDelRescatado, null, null);
		Tarea tDelHijo = tarea("t del hijo del rescatado", null, hijoDelRescatado, null);
		Idea iDelRescatado = ideaDeProyecto("i del rescatado", rescatado);
		recordatorioDe(tDelRescatado);
		sincronizar();

		service.eliminar(o.getId(), elige(null, BORRAR, BORRAR, BORRAR));
		sincronizar();

		assertThat(existe(tDeP)).isFalse();
		assertThat(existe(tDelRescatado)).isTrue();
		assertThat(leer(tDelRescatado).getProyectoId()).isEqualTo(rescatado.getId());
		assertThat(existe(subDelRescatado)).isTrue();
		assertThat(existe(tDelHijo)).isTrue();
		assertThat(leer(tDelHijo).getProyectoId()).isEqualTo(hijoDelRescatado.getId());
		assertThat(recordatoriosDe(tDelRescatado)).isEqualTo(1);
		assertThat(existe(iDelRescatado)).isTrue();
	}

	// ---- Tareas e ideas del objetivo ----

	@Test
	void tareasBorrarEliminaLasLigadasAlObjetivoYAlProyectoBorradoConSusSubtareasNoLigadas() {
		Objetivo o = objetivo("o", null);
		Proyecto p = proyecto("p", null, o);
		Tarea tDelObjetivo = tarea("t del objetivo", null, null, o);
		Tarea subNoLigada = tarea("sub no ligada", tDelObjetivo, null, null);
		Tarea tDelProyecto = tarea("t del proyecto", null, p, null);
		Tarea ajena = tarea("ajena", null, null, null);
		recordatorioDe(subNoLigada);
		sincronizar();

		service.eliminar(o.getId(), elige(null, BORRAR, BORRAR, null));
		sincronizar();

		assertThat(existe(tDelObjetivo)).isFalse();
		assertThat(existe(subNoLigada)).isFalse();
		assertThat(recordatoriosDe(subNoLigada)).isZero();
		assertThat(existe(tDelProyecto)).isFalse();
		assertThat(existe(ajena)).isTrue();
	}

	@Test
	void tareasConservarDesligaSoloLaColumnaQueApuntaAAlgoBorrado() {
		Objetivo o = objetivo("o", null);
		Objetivo otro = objetivo("otro", null);
		Proyecto p = proyecto("p", null, o);
		Tarea soloObjetivo = tarea("solo del objetivo", null, null, o);
		Tarea ambos = tarea("del proyecto y del objetivo", null, p, o);
		Tarea proyectoYOtroObjetivo = tarea("del proyecto y de otro objetivo", null, p, otro);
		sincronizar();

		service.eliminar(o.getId(), elige(null, BORRAR, CONSERVAR, null));
		sincronizar();

		assertThat(leer(soloObjetivo).getObjetivoId()).isNull();
		assertThat(leer(ambos).getProyectoId()).isNull();
		assertThat(leer(ambos).getObjetivoId()).isNull();
		assertThat(leer(proyectoYOtroObjetivo).getProyectoId()).isNull();
		assertThat(leer(proyectoYOtroObjetivo).getObjetivoId()).isEqualTo(otro.getId());
	}

	@Test
	void ideasBorrarYConservarSeAplicanAlObjetivoYALosProyectosBorrados() {
		Objetivo o = objetivo("o", null);
		Proyecto p = proyecto("p", null, o);
		Idea delObjetivo = ideaDeObjetivo("del objetivo", o);
		Idea delProyecto = ideaDeProyecto("del proyecto", p);
		Idea libre = ideaDeObjetivo("libre", null);
		sincronizar();

		service.eliminar(o.getId(), elige(null, BORRAR, null, BORRAR));
		sincronizar();

		assertThat(existe(delObjetivo)).isFalse();
		assertThat(existe(delProyecto)).isFalse();
		assertThat(existe(libre)).isTrue();
	}

	@Test
	void ideasConservarLasDejaLibres() {
		Objetivo o = objetivo("o", null);
		Proyecto p = proyecto("p", null, o);
		Idea delObjetivo = ideaDeObjetivo("del objetivo", o);
		Idea delProyecto = ideaDeProyecto("del proyecto", p);
		sincronizar();

		service.eliminar(o.getId(), elige(null, BORRAR, null, CONSERVAR));
		sincronizar();

		Idea a = ideaRepository.findById(delObjetivo.getId()).orElseThrow();
		Idea b = ideaRepository.findById(delProyecto.getId()).orElseThrow();
		assertThat(a.getObjetivoId()).isNull();
		assertThat(b.getProyectoId()).isNull();
	}

	// ---- 409: nada se borra a medias ----

	@Test
	void subobjetivosSinEleccionDa409ConElNombreYNoBorraNada() {
		Objetivo salud = objetivo("Salud", null);
		Objetivo sub = objetivo("sub", salud);
		sincronizar();

		assertThatThrownBy(() -> service.eliminar(salud.getId(), elige(null, BORRAR, BORRAR, BORRAR)))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessage("El objetivo «Salud» tiene subobjetivos: indica si quieres borrarlos o conservarlos");
		sincronizar();

		assertThat(existe(salud)).isTrue();
		assertThat(existe(sub)).isTrue();
	}

	@Test
	void proyectosSinEleccionDa409ConElNombreYNoBorraNada() {
		Objetivo salud = objetivo("Salud", null);
		Proyecto p = proyecto("p", null, salud);
		Tarea t = tarea("t", null, null, salud);
		sincronizar();

		assertThatThrownBy(() -> service.eliminar(salud.getId(), elige(null, null, BORRAR, BORRAR)))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessage("El objetivo «Salud» tiene proyectos: indica si quieres borrarlos o conservarlos");
		sincronizar();

		assertThat(existe(salud)).isTrue();
		assertThat(existe(p)).isTrue();
		assertThat(objetivoDe(p)).isEqualTo(salud.getId());
		assertThat(existe(t)).isTrue();
	}

	@Test
	void tareasSoloEnUnProyectoABorrarSinEleccionDeTareasDa409YNoBorraNada() {
		Objetivo salud = objetivo("Salud", null);
		Proyecto p = proyecto("p", null, salud);
		Proyecto sub = proyecto("sub", p, null);
		Tarea t = tarea("t del sub", null, sub, null);
		Idea i = ideaDeObjetivo("i", salud);
		sincronizar();

		assertThatThrownBy(() -> service.eliminar(salud.getId(), elige(null, BORRAR, null, BORRAR)))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessage("El objetivo «Salud» tiene tareas: indica si quieres borrarlas o conservarlas");
		sincronizar();

		assertThat(existe(salud)).isTrue();
		assertThat(existe(p)).isTrue();
		assertThat(existe(sub)).isTrue();
		assertThat(existe(t)).isTrue();
		assertThat(leer(t).getProyectoId()).isEqualTo(sub.getId());
		assertThat(existe(i)).isTrue();
	}

	@Test
	void conProyectosConservarLasTareasDelProyectoNoCuentanYNoHaceFaltaElegirlas() {
		Objetivo salud = objetivo("Salud", null);
		Proyecto p = proyecto("p", null, salud);
		Tarea delProyecto = tarea("t del proyecto conservado", null, p, null);
		sincronizar();

		service.eliminar(salud.getId(), elige(null, CONSERVAR, null, null));
		sincronizar();

		assertThat(existe(salud)).isFalse();
		assertThat(objetivoDe(p)).isNull();
		assertThat(leer(delProyecto).getProyectoId()).isEqualTo(p.getId());
	}

	@Test
	void ideasSinEleccionDa409ConElNombreYNoBorraNada() {
		Objetivo salud = objetivo("Salud", null);
		Idea i = ideaDeObjetivo("i", salud);
		sincronizar();

		assertThatThrownBy(() -> service.eliminar(salud.getId(), EleccionesBorradoObjetivo.NINGUNA))
				.isInstanceOf(ObjetivoConDependenciasException.class)
				.hasMessage("El objetivo «Salud» tiene ideas: indica si quieres borrarlas o conservarlas");
		sincronizar();

		assertThat(existe(salud)).isTrue();
		assertThat(existe(i)).isTrue();
	}

	// ---- Elecciones mixtas ----

	@Test
	void eleccionesMixtasSubobjetivosConservarProyectosBorrarTareasConservarIdeasBorrar() {
		Objetivo abuelo = objetivo("abuelo", null);
		Objetivo o = objetivo("o", abuelo);
		Objetivo sub = objetivo("sub", o);
		Objetivo otro = objetivo("otro", null);
		Proyecto p = proyecto("p", null, o);
		Proyecto subDeP = proyecto("sub de p", p, null);
		Proyecto rescatado = proyecto("rescatado", p, otro);
		Proyecto pDelSub = proyecto("p del subobjetivo", null, sub);
		Tarea tDeP = tarea("t de p", null, p, null);
		Tarea tDelSubDeP = tarea("t del sub de p", null, subDeP, null);
		Tarea tDelObjetivo = tarea("t del objetivo", null, null, o);
		Idea iDeP = ideaDeProyecto("i de p", p);
		Idea iDelObjetivo = ideaDeObjetivo("i del objetivo", o);
		sincronizar();

		service.eliminar(o.getId(), elige(CONSERVAR, BORRAR, CONSERVAR, BORRAR));
		sincronizar();

		// Subobjetivos: sub sobrevive y sube al abuelo.
		assertThat(existe(o)).isFalse();
		assertThat(existe(sub)).isTrue();
		assertThat(padreDe(sub)).isEqualTo(abuelo.getId());
		// Proyectos: los de o se borran con su sub-árbol salvo el rescatado; el del subobjetivo (que se conserva) no se toca.
		assertThat(existe(p)).isFalse();
		assertThat(existe(subDeP)).isFalse();
		assertThat(existe(rescatado)).isTrue();
		assertThat(padreDe(rescatado)).isNull();
		assertThat(existe(pDelSub)).isTrue();
		assertThat(objetivoDe(pDelSub)).isEqualTo(sub.getId());
		// Tareas: se conservan, desligadas.
		assertThat(existe(tDeP)).isTrue();
		assertThat(leer(tDeP).getProyectoId()).isNull();
		assertThat(existe(tDelSubDeP)).isTrue();
		assertThat(leer(tDelSubDeP).getProyectoId()).isNull();
		assertThat(existe(tDelObjetivo)).isTrue();
		assertThat(leer(tDelObjetivo).getObjetivoId()).isNull();
		// Ideas: se borran.
		assertThat(existe(iDeP)).isFalse();
		assertThat(existe(iDelObjetivo)).isFalse();
	}

	@Test
	void eleccionesMixtasSubobjetivosBorrarProyectosConservarTareasBorrarIdeasConservar() {
		Objetivo raiz = objetivo("raiz", null);
		Objetivo sub = objetivo("sub", raiz);
		Proyecto pDeLaRaiz = proyecto("p de la raiz", null, raiz);
		Proyecto pDelSub = proyecto("p del sub", null, sub);
		Tarea tDeP = tarea("t del proyecto conservado", null, pDeLaRaiz, null);
		Tarea tDelSub = tarea("t del sub", null, null, sub);
		Idea iDelSub = ideaDeObjetivo("i del sub", sub);
		sincronizar();

		service.eliminar(raiz.getId(), elige(BORRAR, CONSERVAR, BORRAR, CONSERVAR));
		sincronizar();

		assertThat(existe(raiz)).isFalse();
		assertThat(existe(sub)).isFalse();
		assertThat(existe(pDeLaRaiz)).isTrue();
		assertThat(objetivoDe(pDeLaRaiz)).isNull();
		assertThat(existe(pDelSub)).isTrue();
		assertThat(objetivoDe(pDelSub)).isNull();
		assertThat(existe(tDeP)).isTrue(); // el proyecto se conserva: su tarea no se toca
		assertThat(leer(tDeP).getProyectoId()).isEqualTo(pDeLaRaiz.getId());
		assertThat(existe(tDelSub)).isFalse();
		Idea idea = ideaRepository.findById(iDelSub.getId()).orElseThrow();
		assertThat(idea.getObjetivoId()).isNull();
	}
}
