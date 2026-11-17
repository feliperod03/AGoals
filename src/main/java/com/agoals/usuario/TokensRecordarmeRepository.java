package com.agoals.usuario;

import org.springframework.security.web.authentication.rememberme.JdbcTokenRepositoryImpl;

import java.sql.Timestamp;
import java.time.Instant;

/** JdbcTokenRepositoryImpl (tabla persistent_logins, migración V4) más dos operaciones que Spring no trae. */
public class TokensRecordarmeRepository extends JdbcTokenRepositoryImpl {

	/** Borra solo la serie de un dispositivo (removeUserTokens borra todos los del usuario). */
	public void removeSeries(String series) {
		getJdbcTemplate().update("delete from persistent_logins where series = ?", series);
	}

	/** Spring no borra nunca los tokens vencidos: solo los rechaza. Se limpian los de ese usuario al crear uno nuevo. */
	public void borrarVencidos(String username, Instant antesDe) {
		getJdbcTemplate().update("delete from persistent_logins where username = ? and last_used < ?", username,
				Timestamp.from(antesDe));
	}
}
