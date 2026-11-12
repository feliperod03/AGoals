package com.agoals.tarea;

import com.agoals.common.Estado;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TareaRepository extends JpaRepository<Tarea, Long> {

	Optional<Tarea> findByIdAndUsuarioId(Long id, Long usuarioId);

	boolean existsByPadreIdAndUsuarioId(Long padreId, Long usuarioId);

	List<Tarea> findByPadreIdAndUsuarioId(Long padreId, Long usuarioId);

	List<Tarea> findByUsuarioIdOrderByFechaAscIdAsc(Long usuarioId);

	List<Tarea> findByUsuarioIdAndFechaOrderByHoraInicioAscIdAsc(Long usuarioId, LocalDate fecha);

	// "Before" es estricto y excluye fecha NULL (NULL < fecha no es verdadero): sin agendar no es atrasada.
	List<Tarea> findByUsuarioIdAndFechaBeforeAndEstadoIn(Long usuarioId, LocalDate fecha, Collection<Estado> estados);

	// Candidatas a la recomendación: abiertas y (sin fecha o con fecha anterior a la indicada).
	// No filtra por proyecto/objetivo: el service necesita también las hijas que no cumplen el filtro.
	@Query("select t from Tarea t where t.usuarioId = :usuarioId and t.estado in :estados "
			+ "and (t.fecha is null or t.fecha < :fecha)")
	List<Tarea> findCandidatasRecomendacion(@Param("usuarioId") Long usuarioId, @Param("fecha") LocalDate fecha,
			@Param("estados") Collection<Estado> estados);

	// Futuras dentro del horizonte (5c): abiertas con fecha > :fecha y <= :hasta (hoy no entra, hasta sí).
	// Los dos extremos son siempre no nulos: el service no llama a este método sin horizonte.
	@Query("select t from Tarea t where t.usuarioId = :usuarioId and t.estado in :estados "
			+ "and t.fecha > :fecha and t.fecha <= :hasta")
	List<Tarea> findFuturasRecomendacion(@Param("usuarioId") Long usuarioId, @Param("fecha") LocalDate fecha,
			@Param("hasta") LocalDate hasta, @Param("estados") Collection<Estado> estados);

	List<Tarea> findByUsuarioIdAndProyectoIdOrderByFechaAscIdAsc(Long usuarioId, Long proyectoId);

	List<Tarea> findByUsuarioIdAndObjetivoIdOrderByFechaAscIdAsc(Long usuarioId, Long objetivoId);

	// Para el borrado de proyectos/objetivos (5e). Nunca llamar con una colección vacía: el service lo evita.
	List<Tarea> findByUsuarioIdAndProyectoIdIn(Long usuarioId, Collection<Long> proyectoIds);

	List<Tarea> findByUsuarioIdAndObjetivoIdIn(Long usuarioId, Collection<Long> objetivoIds);
}
