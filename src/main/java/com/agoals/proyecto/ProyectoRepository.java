package com.agoals.proyecto;

import com.agoals.common.Estado;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProyectoRepository extends JpaRepository<Proyecto, Long> {

	Optional<Proyecto> findByIdAndUsuarioId(Long id, Long usuarioId);

	boolean existsByPadreIdAndUsuarioId(Long padreId, Long usuarioId);

	// Filtros opcionales: un parámetro null significa "no filtrar por este campo".
	@Query("""
			SELECT p FROM Proyecto p
			WHERE p.usuarioId = :usuarioId
			  AND (:estado IS NULL OR p.estado = :estado)
			  AND (:objetivoId IS NULL OR p.objetivoId = :objetivoId)
			ORDER BY p.id
			""")
	List<Proyecto> listar(@Param("usuarioId") Long usuarioId,
			@Param("estado") Estado estado,
			@Param("objetivoId") Long objetivoId);
}
