package com.agoals.objetivo;

import com.agoals.common.Estado;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ObjetivoRepository extends JpaRepository<Objetivo, Long> {

	Optional<Objetivo> findByIdAndUsuarioId(Long id, Long usuarioId);

	boolean existsByIdAndUsuarioId(Long id, Long usuarioId);

	boolean existsByPadreIdAndUsuarioId(Long padreId, Long usuarioId);

	List<Objetivo> findByPadreIdAndUsuarioId(Long padreId, Long usuarioId);

	// Filtro opcional: estado null significa "todos".
	@Query("""
			SELECT o FROM Objetivo o
			WHERE o.usuarioId = :usuarioId
			  AND (:estado IS NULL OR o.estado = :estado)
			ORDER BY o.id
			""")
	List<Objetivo> listar(@Param("usuarioId") Long usuarioId, @Param("estado") Estado estado);
}
