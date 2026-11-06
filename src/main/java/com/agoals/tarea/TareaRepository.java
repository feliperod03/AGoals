package com.agoals.tarea;

import com.agoals.common.Estado;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TareaRepository extends JpaRepository<Tarea, Long> {

	Optional<Tarea> findByIdAndUsuarioId(Long id, Long usuarioId);

	List<Tarea> findByUsuarioIdOrderByFechaAscIdAsc(Long usuarioId);

	List<Tarea> findByUsuarioIdAndFechaOrderByHoraInicioAscIdAsc(Long usuarioId, LocalDate fecha);

	// "Before" es estricto y excluye fecha NULL (NULL < fecha no es verdadero): sin agendar no es atrasada.
	List<Tarea> findByUsuarioIdAndFechaBeforeAndEstadoIn(Long usuarioId, LocalDate fecha, Collection<Estado> estados);

	List<Tarea> findByUsuarioIdAndProyectoIdOrderByFechaAscIdAsc(Long usuarioId, Long proyectoId);

	boolean existsByUsuarioIdAndProyectoId(Long usuarioId, Long proyectoId);

	List<Tarea> findByUsuarioIdAndObjetivoIdOrderByFechaAscIdAsc(Long usuarioId, Long objetivoId);

	boolean existsByUsuarioIdAndObjetivoId(Long usuarioId, Long objetivoId);
}
