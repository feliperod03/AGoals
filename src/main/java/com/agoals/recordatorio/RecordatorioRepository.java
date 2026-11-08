package com.agoals.recordatorio;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

// Solo consultas derivadas: un @Query con parámetros OffsetDateTime opcionales (null) falla en PostgreSQL con
// "could not determine data type of parameter". Los filtros opcionales se aplican en RecordatorioService.
public interface RecordatorioRepository extends JpaRepository<Recordatorio, Long> {

	Optional<Recordatorio> findByIdAndUsuarioId(Long id, Long usuarioId);

	List<Recordatorio> findByUsuarioIdOrderByFechaHoraAscIdAsc(Long usuarioId);

	boolean existsByTareaIdAndUsuarioId(Long tareaId, Long usuarioId);

	boolean existsByEventoIdAndUsuarioId(Long eventoId, Long usuarioId);

	// `ahora` es obligatorio (lo manda el cliente), así que nunca es null.
	List<Recordatorio> findByUsuarioIdAndEnviadoFalseAndFechaHoraLessThanEqualOrderByFechaHoraAscIdAsc(
			Long usuarioId, OffsetDateTime ahora);
}
