package com.agoals.serie;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SerieEventoRepository extends JpaRepository<SerieEvento, Long> {

	Optional<SerieEvento> findByIdAndUsuarioId(Long id, Long usuarioId);
}
