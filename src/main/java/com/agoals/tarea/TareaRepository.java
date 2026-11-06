package com.agoals.tarea;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TareaRepository extends JpaRepository<Tarea, Long> {

	Optional<Tarea> findByIdAndUsuarioId(Long id, Long usuarioId);

	List<Tarea> findByUsuarioIdOrderByFechaAscIdAsc(Long usuarioId);

	List<Tarea> findByUsuarioIdAndFechaOrderByHoraInicioAscIdAsc(Long usuarioId, LocalDate fecha);

	List<Tarea> findByUsuarioIdAndProyectoIdOrderByFechaAscIdAsc(Long usuarioId, Long proyectoId);

	boolean existsByUsuarioIdAndProyectoId(Long usuarioId, Long proyectoId);
}
