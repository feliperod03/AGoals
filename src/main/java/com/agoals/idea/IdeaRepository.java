package com.agoals.idea;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface IdeaRepository extends JpaRepository<Idea, Long> {

	Optional<Idea> findByIdAndUsuarioId(Long id, Long usuarioId);

	boolean existsByProyectoIdAndUsuarioId(Long proyectoId, Long usuarioId);

	boolean existsByObjetivoIdAndUsuarioId(Long objetivoId, Long usuarioId);

	// Filtros opcionales: un parámetro null significa "no filtrar por este campo".
	// `libres` es un boolean primitivo (nunca null): false = no filtrar, true = solo ideas sin vínculo.
	@Query("""
			SELECT i FROM Idea i
			WHERE i.usuarioId = :usuarioId
			  AND (:estado IS NULL OR i.estado = :estado)
			  AND (:proyectoId IS NULL OR i.proyectoId = :proyectoId)
			  AND (:objetivoId IS NULL OR i.objetivoId = :objetivoId)
			  AND (:libres = false OR (i.proyectoId IS NULL AND i.objetivoId IS NULL))
			ORDER BY i.fechaCreacion DESC, i.id DESC
			""")
	List<Idea> listar(@Param("usuarioId") Long usuarioId,
			@Param("estado") EstadoIdea estado,
			@Param("proyectoId") Long proyectoId,
			@Param("objetivoId") Long objetivoId,
			@Param("libres") boolean libres);
}
