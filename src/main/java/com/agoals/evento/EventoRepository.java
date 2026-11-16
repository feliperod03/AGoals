package com.agoals.evento;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface EventoRepository extends JpaRepository<Evento, Long> {

	Optional<Evento> findByIdAndUsuarioId(Long id, Long usuarioId);

	// Todos los eventos del usuario, ya ordenados. El filtro por rango (solapamiento) lo hace EventoService:
	// un @Query con parámetros OffsetDateTime opcionales (":desde IS NULL OR ...") falla en PostgreSQL con
	// "could not determine data type of parameter" cuando el valor es null.
	List<Evento> findByUsuarioIdOrderByFechaHoraInicioAscIdAsc(Long usuarioId);

	// Series: "esta y las siguientes" por instante de inicio. Los parámetros nunca son null.
	List<Evento> findBySerieIdAndUsuarioIdAndFechaHoraInicioGreaterThanEqualOrderByFechaHoraInicioAscIdAsc(
			Long serieId, Long usuarioId, OffsetDateTime desde);

	boolean existsBySerieIdAndUsuarioId(Long serieId, Long usuarioId);
}
